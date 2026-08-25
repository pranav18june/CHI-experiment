import pandas as pd, numpy as np, math

tr = pd.read_csv('walmart/train.csv', parse_dates=['Date'])
st = pd.read_csv('walmart/stores.csv')

Z, LT = 1.645, 2
CR_Z = 0.385  # Phi^-1(0.65)

print("SAFETY STOCK — protocol says: SS = Z x sigma_weekly x sqrt(LT)\n")
print(f"{'inst':6} {'store/dept':11} {'type':5} {'n':>4} {'mean':>10} {'sd':>10} {'SS calc':>9} {'Appx A':>8} {'match':>7}")
ss_spec = [('SS-1',42,92,83498,12573,29251), ('SS-2',13,72,77119,21135,49159), ('SS-3',10,5,58373,28826,67054)]
for name, s, d, pm, psd, popt in ss_spec:
    g = tr[(tr.Store==s)&(tr.Dept==d)]['Weekly_Sales']
    typ = st[st.Store==s]['Type'].iloc[0] if 'Type' in st.columns else '?'
    mean, sd = g.mean(), g.std(ddof=1)
    calc = Z*sd*math.sqrt(LT)
    ok = 'YES' if abs(calc-popt)/popt < 0.01 else f'{abs(calc-popt)/popt*100:.1f}% off'
    print(f"{name:6} {str(s)+'/'+str(d):11} {typ:5} {len(g):>4} {mean:>10,.0f} {sd:>10,.0f} {calc:>9,.0f} {popt:>8,} {ok:>7}")
    print(f"{'':6} protocol stated mean {pm:,} sd {psd:,}  ->  data mean {mean:,.0f} sd {sd:,.0f}")

print("\nNEWSVENDOR — Q* = mu + z x sigma on HOLIDAY weeks only\n")
print(f"{'inst':6} {'store/dept':11} {'n':>4} {'mean':>10} {'sd':>10} {'Q* calc':>9} {'Appx A':>8} {'match':>7}")
nv_spec = [('NV-1',10,72,263476,215016,346257), ('NV-2',4,72,165676,117520,210921), ('NV-3',14,72,163875,141160,218222)]
for name, s, d, pm, psd, popt in nv_spec:
    g = tr[(tr.Store==s)&(tr.Dept==d)&(tr.IsHoliday==True)]['Weekly_Sales']
    mean, sd = g.mean(), g.std(ddof=1)
    calc = mean + CR_Z*sd
    ok = 'YES' if abs(calc-popt)/popt < 0.01 else f'{abs(calc-popt)/popt*100:.1f}% off'
    print(f"{name:6} {str(s)+'/'+str(d):11} {len(g):>4} {mean:>10,.0f} {sd:>10,.0f} {calc:>9,.0f} {popt:>8,} {ok:>7}")
    print(f"{'':6} protocol stated mean {pm:,} sd {psd:,}  ->  data mean {mean:,.0f} sd {sd:,.0f}")
