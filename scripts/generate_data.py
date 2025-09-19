import pandas as pd
import numpy as np
from pathlib import Path

np.random.seed(42)

# Carpeta de salida
output_dir = Path(__file__).parent.parent / "data"
output_dir.mkdir(exist_ok=True)
output_file = output_dir / "ventas.csv"  # <-- cambiar a CSV

# Productos y configuración
products = [
    {"id": 1, "name": "Smartphone", "base_price": 700, "base_demand": 150},
    {"id": 2, "name": "Laptop", "base_price": 1200, "base_demand": 80},
    {"id": 3, "name": "Headphones", "base_price": 150, "base_demand": 250},
    {"id": 4, "name": "Smartwatch", "base_price": 300, "base_demand": 120},
]

stores = ["Sucursal A", "Sucursal B", "Sucursal C"]
date_range = pd.date_range(end=pd.Timestamp.today().normalize(), periods=48, freq="MS")

rows = []

for date_idx, date in enumerate(date_range, start=1):
    growth_factor = 1 + (date_idx / 100)  # tendencia creciente

    for product in products:
        # Canal Web
        units_web = np.random.poisson(lam=product["base_demand"] * 0.8 * growth_factor)
        price_web = np.random.normal(loc=product["base_price"] * 1.05, scale=product["base_price"] * 0.05)
        rows.append({
            "date": date.strftime("%Y-%m-%d"),
            "product_id": product["id"],
            "product_name": product["name"],
            "channel": "Web",
            "store": "Web",
            "units": int(max(0, units_web)),
            "price": round(price_web, 2),
            "revenue": round(units_web * price_web, 2)
        })

        # Canales físicos
        for store in stores:
            units_store = np.random.poisson(lam=product["base_demand"] * 0.6 * growth_factor)
            price_store = np.random.normal(loc=product["base_price"], scale=product["base_price"] * 0.05)
            rows.append({
                "date": date.strftime("%Y-%m-%d"),
                "product_id": product["id"],
                "product_name": product["name"],
                "channel": "Store",
                "store": store,
                "units": int(max(0, units_store)),
                "price": round(price_store, 2),
                "revenue": round(units_store * price_store, 2)
            })

df = pd.DataFrame(rows)

# Guardar como CSV
df.to_csv(output_file, index=False)
print(f"Archivo generado: {output_file}")
