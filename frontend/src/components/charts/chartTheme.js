/* Canvas charts need resolved CSS colors, not var() expressions. */
export function chartTheme(element) {
  const css = getComputedStyle(element);
  const color = name => css.getPropertyValue(name).trim();
  const border = color('--border-subtle');
  const text = color('--text-secondary');
  return {
    layout: { background: { color: color('--bg-surface') }, textColor: text },
    grid: { vertLines: { color: border }, horzLines: { color: border } },
    crosshair: { vertLine: { color: color('--border-active') }, horzLine: { color: color('--border-active') } },
    rightPriceScale: { borderColor: border, textColor: text },
    timeScale: { borderColor: border, textColor: text },
  };
}

export function observeChartTheme(chart, element) {
  const observer = new MutationObserver(() => chart.applyOptions(chartTheme(element)));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
