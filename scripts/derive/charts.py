import pandas as pd, numpy as np, json, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

man = json.load(open('/tmp/olist_manifest.json'))
o  = pd.read_csv('olist/olist_orders_dataset.csv', parse_dates=['order_purchase_timestamp','order_delivered_customer_date','order_estimated_delivery_date'])
it = pd.read_csv('olist/olist_order_items_dataset.csv')
pr = pd.read_csv('olist/olist_products_dataset.csv')
tx = pd.read_csv('olist/product_category_name_translation.csv')
d = o[o.order_status=='delivered'].dropna(subset=['order_delivered_customer_date'])
d = d.assign(lead=(d.order_delivered_customer_date-d.order_purchase_timestamp).dt.total_seconds()/86400,
             late=(d.order_delivered_customer_date-d.order_estimated_delivery_date).dt.total_seconds()/86400)
d = d[(d.lead>0)&(d.lead<120)]
m = (it.merge(pr[['product_id','product_category_name']],on='product_id').merge(tx,on='product_category_name',how='left')
       .merge(d[['order_id','order_purchase_timestamp','lead','late']],on='order_id'))
m['cat']=m.product_category_name_english.fillna(m.product_category_name)
m['day']=m.order_purchase_timestamp.dt.floor('D')

TITLES = {'ROP-1':('Pet Shop',7),'ROP-2':('Bed Bath Table',8),'ROP-3':('Office Furniture',9),
          'EW-1':('Fashion Bags',10),'EW-2':('Auto Parts',11),'EW-3':('Electronics',12)}
BLUE, RED = '#4878a8', '#b5502f'

for sid,(label,num) in TITLES.items():
    v = man[sid]; lo,hi = v['window']
    g = m[(m.cat==v['category'])&(m.day>=lo)&(m.day<hi)]
    fig, ax = plt.subplots(2,1, figsize=(10,7.6), gridspec_kw={'height_ratios':[1.15,1]})
    fig.suptitle(f"{label} — Weekly Order Value & Delivery Time", fontsize=16, fontweight='bold', y=0.98)

    wk = g.groupby(pd.Grouper(key='day', freq='W')).price.sum()
    ax[0].bar(wk.index, wk.values, width=5.4, color=BLUE, edgecolor='white', linewidth=.5)
    ax[0].set_title('Real weekly order-value history', loc='left', fontsize=11, color='#555')
    ax[0].set_ylabel('Order value ($/week)'); ax[0].grid(axis='y', alpha=.3)
    for s in ('top','right'): ax[0].spines[s].set_visible(False)

    if v['family']=='rop':
        ax[1].hist(g.lead, bins=30, color=RED, edgecolor='white')
        ax[1].set_title('Real delivery-time distribution', loc='left', fontsize=11, color='#555')
        ax[1].set_xlabel('Order-to-delivery time (days)'); ax[1].set_ylabel('Number of orders')
    else:
        ax[1].hist(g.late, bins=34, color=RED, edgecolor='white')
        ax[1].axvline(0, color='#333', lw=1.4, ls='--')
        ax[1].set_title('Real delivery vs. promised date  (0 = on time, right of dashed line = late)',
                        loc='left', fontsize=11, color='#555')
        ax[1].set_xlabel('Days relative to promised delivery date'); ax[1].set_ylabel('Number of orders')
    ax[1].grid(axis='y', alpha=.3)
    for s in ('top','right'): ax[1].spines[s].set_visible(False)

    # Format the date axis explicitly: autofmt_xdate would strip labels from the
    # top panel, whose x-axis is dates while the bottom panel's is numeric days.
    ax[0].xaxis.set_major_locator(mdates.MonthLocator())
    ax[0].xaxis.set_major_formatter(mdates.DateFormatter('%b %Y'))
    for lbl in ax[0].get_xticklabels():
        lbl.set_rotation(30); lbl.set_ha('right')
    fig.tight_layout(rect=[0,0,1,0.96])
    fig.savefig(f'public/graphs/{num}.png', dpi=110, facecolor='white')
    plt.close(fig)
    print(f"  {sid} -> graphs/{num}.png   weeks={len(wk)}  orders={len(g):,}  window {lo}→{hi}")
