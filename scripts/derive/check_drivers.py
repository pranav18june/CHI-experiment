import pandas as pd, numpy as np
tr = pd.read_csv('walmart/train.csv', parse_dates=['Date'])
fe = pd.read_csv('walmart/features.csv', parse_dates=['Date'])
fe = fe.replace('NA', np.nan)
for c in ['Temperature','Fuel_Price','CPI','Unemployment','MarkDown1','MarkDown2','MarkDown3','MarkDown4','MarkDown5']:
    fe[c] = pd.to_numeric(fe[c], errors='coerce')

# Protocol's stated C1 attributions
spec = {
 'SS-1': (42, 92, {'Promotional markdown present': 0.26, 'Temperature': -0.28}),
 'SS-2': (13, 72, {'Holiday-week indicator': 0.43, 'Temperature': -0.45}),
 'SS-3': (10,  5, {'Temperature': -0.47, 'Holiday-week indicator': 0.23}),
 'NV-1': (10, 72, {'Holiday-week indicator': 0.44, 'Temperature': -0.40}),
 'NV-2': ( 4, 72, {'Holiday-week indicator': 0.37, 'Temperature': -0.44}),
 'NV-3': (14, 72, {'Holiday-week indicator': 0.37, 'Temperature': -0.38}),
}
print("Standardised correlation of weekly sales with each driver (data) vs Appendix A\n")
print(f"{'inst':6} {'driver':30} {'data r':>9} {'Appx A':>8} {'diff':>7}")
for name,(s,d,drivers) in spec.items():
    g = tr[(tr.Store==s)&(tr.Dept==d)].merge(fe[fe.Store==s], on=['Store','Date'], how='left')
    g['markdown_present'] = g[['MarkDown1','MarkDown2','MarkDown3','MarkDown4','MarkDown5']].notna().any(axis=1).astype(float)
    g['holiday'] = g['IsHoliday_x'].astype(float) if 'IsHoliday_x' in g else g['IsHoliday'].astype(float)
    col = {'Promotional markdown present':'markdown_present','Temperature':'Temperature','Holiday-week indicator':'holiday'}
    for dn, stated in drivers.items():
        r = g['Weekly_Sales'].corr(g[col[dn]])
        print(f"{name:6} {dn:30} {r:>9.2f} {stated:>8.2f} {abs(r-stated):>7.2f}")
