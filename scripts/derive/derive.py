"""Derives every ROP/EW stimulus value from the Olist dataset. Emits a manifest."""
import pandas as pd, numpy as np, math, json

WIN_LO, WIN_HI = '2018-02-01', '2018-08-01'   # recent, reasonably stable planning window
Z = 1.645                                      # 95% service level (same constant as safety stock)

o  = pd.read_csv('olist/olist_orders_dataset.csv', parse_dates=[
      'order_purchase_timestamp','order_delivered_customer_date','order_estimated_delivery_date'])
it = pd.read_csv('olist/olist_order_items_dataset.csv')
pr = pd.read_csv('olist/olist_products_dataset.csv')
tx = pd.read_csv('olist/product_category_name_translation.csv')
cu = pd.read_csv('olist/olist_customers_dataset.csv')
se = pd.read_csv('olist/olist_sellers_dataset.csv')

d = o[o.order_status=='delivered'].dropna(subset=['order_delivered_customer_date'])
d = d.assign(lead=(d.order_delivered_customer_date-d.order_purchase_timestamp).dt.total_seconds()/86400,
             late=(d.order_delivered_customer_date-d.order_estimated_delivery_date).dt.total_seconds()/86400)
d = d[(d.lead>0)&(d.lead<120)]

m = (it.merge(pr[['product_id','product_category_name','product_weight_g']],on='product_id')
       .merge(tx,on='product_category_name',how='left')
       .merge(d[['order_id','customer_id','order_purchase_timestamp','lead','late']],on='order_id')
       .merge(cu[['customer_id','customer_state']],on='customer_id',how='left')
       .merge(se[['seller_id','seller_state']],on='seller_id',how='left'))
m['cat']=m.product_category_name_english.fillna(m.product_category_name)
m['day']=m.order_purchase_timestamp.dt.floor('D')
w = m[(m.day>=WIN_LO)&(m.day<WIN_HI)].copy()
w['is_late']=(w.late>0).astype(float)
w['cross_state']=(w.customer_state!=w.seller_state).astype(float)

DAYS = pd.date_range(WIN_LO, WIN_HI, freq='D')[:-1]

def daily_series(g):
    return g.groupby('day').price.sum().reindex(DAYS, fill_value=0.0)

def rop(dbar, sd, L, sL):
    return dbar*L + Z*math.sqrt(L*sd**2 + dbar**2*sL**2)

def solve_rop_bias(dbar, sd, L, sL, target, which):
    """Find the biased input that yields `target` relative offset."""
    base = rop(dbar, sd, L, sL); goal = base*(1+target)
    anchor = sL if which=='sL' else dbar
    lo, hi = 1e-4, anchor*20
    for _ in range(200):
        mid = (lo+hi)/2
        val = rop(dbar, sd, L, mid) if which=='sL' else rop(mid, sd, L, sL)
        if val > goal: hi = mid
        else: lo = mid
    return (lo+hi)/2

def solve_ew_bias(p, delay, cost, target, which):
    base = p*delay*cost; goal = base*(1+target)
    if which=='cost':  return goal/(p*delay)
    if which=='delay': return goal/(p*cost)
    return goal/(delay*cost)

SPEC = [
  # id,      olist category,            family, perturbed input, target offset
  ('ROP-1','pet_shop',                 'rop','sL',   +0.32),
  ('ROP-2','bed_bath_table',           'rop','dbar', -0.28),
  ('ROP-3','office_furniture',         'rop','sL',   +0.35),
  ('EW-1', 'fashion_bags_accessories', 'ew', 'cost', -0.35),
  ('EW-2', 'auto',                     'ew', 'delay',+0.30),
  ('EW-3', 'electronics',              'ew', 'p',    -0.30),
]

out={}
for sid, cat, fam, which, target in SPEC:
    g = w[w.cat==cat]
    daily = daily_series(g)
    dbar, sd = daily.mean(), daily.std(ddof=1)
    L, sL = g.lead.mean(), g.lead.std(ddof=1)
    p_late = g.is_late.mean()
    delay = g[g.late>0].late.mean()

    # real feature attributions (Pearson correlations, same method as SS/NV)
    gg = g.dropna(subset=['product_weight_g'])
    target_var = gg.lead
    cand = {
      'Cross-state shipment':    float(np.corrcoef(gg.cross_state,      target_var)[0,1]),
      'Freight cost per item':   float(np.corrcoef(gg.freight_value,    target_var)[0,1]),
      'Product weight':          float(np.corrcoef(gg.product_weight_g, target_var)[0,1]),
      'Item price':              float(np.corrcoef(gg.price,            target_var)[0,1]),
    }
    top = sorted(cand.items(), key=lambda kv: -abs(kv[1]))[:2]
    drivers = [(n, round(c,2)) for n,c in top]

    if fam=='rop':
        correct = rop(dbar, sd, L, sL)
        bias = solve_rop_bias(dbar, sd, L, sL, target, which)
        wrong = rop(dbar, sd, L, bias) if which=='sL' else rop(bias, sd, L, sL)
        params = dict(dailyDemandMean=round(dbar,1), dailyDemandStd=round(sd,1),
                      leadTimeMeanDays=round(L,2), leadTimeStdDays=round(sL,2),
                      serviceLevel=0.95, zScore=Z)
    else:
        correct = p_late*delay*dbar
        bias = solve_ew_bias(p_late, delay, dbar, target, which)
        wrong = (bias*delay*dbar if which=='p' else
                 p_late*bias*dbar if which=='delay' else p_late*delay*bias)
        params = dict(lateDeliveryProbability=round(p_late,4), delayDaysWhenLate=round(delay,2),
                      revenueLostPerStockoutDay=round(dbar,1))

    out[sid]=dict(category=cat, family=fam, window=[WIN_LO,WIN_HI], nItems=int(len(g)),
        params=params, perturbedParameter=which, perturbedValue=round(bias,4),
        groundTruthOptimal=int(round(correct)), incorrect=int(round(wrong)),
        offsetPct=round((wrong-correct)/correct*100,1),
        errorDirection='high' if wrong>correct else 'low',
        drivers=drivers, dailyMean=round(dbar,1))

json.dump(out, open('/tmp/olist_manifest.json','w'), indent=1)
print(f"{'id':7}{'n':>7}{'optimum':>10}{'incorrect':>11}{'offset':>9}{'dir':>6}  perturbation")
for k,v in out.items():
    pv = v['perturbedValue']
    print(f"{k:7}{v['nItems']:>7,}{v['groundTruthOptimal']:>10,}{v['incorrect']:>11,}"
          f"{v['offsetPct']:>8.1f}%{v['errorDirection']:>6}  {v['perturbedParameter']}={pv:,.2f}")
print("\nreal driver correlations:")
for k,v in out.items():
    print(f"  {k:7}" + "   ".join(f"{n}: {c:+.2f}" for n,c in v['drivers']))
