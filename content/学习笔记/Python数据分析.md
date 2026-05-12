# Python 数据分析

## 核心工具栈

```
数据分析栈
├── NumPy      → 数值计算
├── Pandas     → 数据处理
├── Matplotlib → 基础可视化
├── Seaborn    → 统计图表
├── Scikit-learn → 机器学习
└── Statsmodels → 统计建模
```

## Pandas 常用操作

### 数据读取
```python
import pandas as pd

df = pd.read_csv('data.csv', parse_dates=['date'])
df = pd.read_excel('data.xlsx', sheet_name='Sheet1')
```

### 数据清洗
```python
df.dropna(subset=['target'])  # 删除缺失值
df.fillna(method='ffill')     # 前向填充
df.duplicated().sum()         # 检查重复
```

### 分组聚合
```python
df.groupby('category')['value'].agg(['mean', 'std', 'count'])
```

## 性能优化

| 方法 | 加速倍数 | 适用场景 |
|------|---------|----------|
| 向量化操作 | 10-100x | 所有数值计算 |
| 使用 category 类型 | 2-5x | 有限类别字符串 |
| Parquet 格式 | 3-10x | 大文件读写 |
| Numba JIT | 10-100x | 循环计算 |
