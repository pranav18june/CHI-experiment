import pandas as pd, numpy as np, math
tr = pd.read_csv('walmart/train.csv', parse_dates=['Date'])
targets = {'SS-1':(42,92,12573), 'SS-2':(13,72,21135), 'SS-3':(10,5,28826)}

def candidates(g):
    s = g['Weekly_Sales']
    nohol = g[~g.IsHoliday]['Weekly_Sales']
    out = {}
    out['raw sd (ddof=1)']        = s.std(ddof=1)
    out['raw sd (ddof=0)']        = s.std(ddof=0)
    out['non-holiday sd']         = nohol.std(ddof=1)
    # detrended: remove linear time trend
    x = np.arange(len(s)); coef = np.polyfit(x, s.values, 1)
    out['detrended sd']           = (s.values - np.polyval(coef, x)).std(ddof=1)
    # deseasonalised: remove week-of-year mean
    w = g.assign(woy=g.Date.dt.isocalendar().week.astype(int))
    out['deseasonalised sd']      = (w.Weekly_Sales - w.groupby('woy').Weekly_Sales.transform('mean')).std(ddof=1)
    # first difference
    out['first-difference sd']    = s.diff().dropna().std(ddof=1)
    # IQR-trimmed
    q1,q3 = s.quantile([.25,.75]); iqr=q3-q1
    out['IQR-trimmed sd']         = s[(s>=q1-1.5*iqr)&(s<=q3+1.5*iqr)].std(ddof=1)
    # 4-week rolling mean residual
    out['resid vs 4wk MA sd']     = (s - s.rolling(4, min_periods=1).mean()).std(ddof=1)
    return out

print(f"{'candidate':24} " + "".join(f"{k:>22}" for k in targets))
print(f"{'':24} " + "".join(f"{'target '+str(v[2]):>22}" for v in targets.values()))
print('-'*92)
rows = {}
for name,(s,d,t) in targets.items():
    rows[name] = candidates(tr[(tr.Store==s)&(tr.Dept==d)])
for cand in rows['SS-1']:
    line = f"{cand:24} "
    for name,(s,d,t) in targets.items():
        v = rows[name][cand]; err = abs(v-t)/t*100
        mark = ' <<<' if err < 2 else ''
        line += f"{v:>14,.0f} {err:>5.1f}%{mark}"[:22].rjust(22)
    print(line)
