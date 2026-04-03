ALLOWED_CURRENCIES = {"USD", "EUR", "BRL"}


def normalize_currency(value: str) -> str:
    normalized = value.strip().upper()
    if normalized not in ALLOWED_CURRENCIES:
        raise ValueError("Currency must be one of: USD, EUR, BRL")
    return normalized
