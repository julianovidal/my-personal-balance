"""Synthetic, deterministic training rows. No real transactions."""

GROCERIES, TRANSPORT, RESTAURANTS = 1, 2, 3

_DESCRIPTIONS = {
    GROCERIES: [
        "COMPRA MERCADONA 1043 MADRID",
        "COMPRA MERCADONA 2210 VALENCIA",
        "CARREFOUR MARKET C/ ALCALA",
        "CARREFOUR EXPRESS GRAN VIA",
        "LIDL SUPERMERCADO 0451",
        "LIDL SUPERMERCADO 0872",
        "DIA %  SUPERMERCADO 3321",
        "ALCAMPO SUPERMERCADO SANCHINARRO",
        "AHORRAMAS 112 MADRID",
        "MERCADONA ONLINE PEDIDO 88412",
        "EROSKI CITY 0091",
        "COMPRA LIDL 1290 GETAFE",
    ],
    TRANSPORT: [
        "UBER *TRIP HELP.UBER.COM",
        "UBER *TRIP 4X2K9",
        "CABIFY MADRID VIAJE",
        "CABIFY *RIDE 55120",
        "RENFE VIAJEROS BILLETE",
        "RENFE CERCANIAS ABONO",
        "METRO DE MADRID RECARGA",
        "METRO DE MADRID TARJETA",
        "BOLT.EU RIDE 9921",
        "REPSOL ESTACION 2231 GASOLINA",
        "CEPSA ESTACION SERVICIO 118",
        "EMT MADRID BONOBUS",
    ],
    RESTAURANTS: [
        "RESTAURANTE CASA PEPE",
        "RESTAURANTE EL BUEN COMER",
        "BAR LA ESQUINA",
        "BAR CERVECERIA EL SOL",
        "TELEPIZZA 0231",
        "BURGER KING 4412 MADRID",
        "MCDONALDS GRAN VIA",
        "GLOVO *PEDIDO 77310",
        "JUST EAT *PEDIDO 1123",
        "CAFETERIA LA ESTACION",
        "TABERNA DEL PUERTO",
        "PIZZERIA NAPOLI 88",
    ],
}


def training_rows() -> list[dict]:
    rows = []
    for tag_id, descriptions in _DESCRIPTIONS.items():
        for description in descriptions:
            rows.append({"description": description, "tag_id": tag_id})
    return rows


# Real accounts have tags of very different sizes. With class_weight="balanced"
# that changes how the logistic regression candidate weighs each tag, which
# equal-sized fixtures cannot show.
_UNEVEN_SIZES = {GROCERIES: 60, TRANSPORT: 20, RESTAURANTS: 6}


def uneven_training_rows() -> list[dict]:
    rows = []
    for tag_id, size in _UNEVEN_SIZES.items():
        descriptions = _DESCRIPTIONS[tag_id]
        for n in range(size):
            base = descriptions[n % len(descriptions)]
            rows.append({"description": f"{base} {(n * 7919) % 10000:04d}", "tag_id": tag_id})
    return rows
