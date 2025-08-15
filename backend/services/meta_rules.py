#services/meta_rules.py
DEFAULT_RULES = {
    "tactical": {               # Taktisk reserv (TR)
        "enabled": True,
        "start_heat": 5,
        "end_heat": 13,
        "min_deficit": 6,       # underläge ≥ 6 p
        "max_per_heat": 1,
        "max_uses_per_rider": 99,  # inga särskilda begränsningar i 2.15.7-Elit
    },
    "ride_limits": {
        "main_max": 5,          # ordinarie max 5 heat
        "reserve_max": 2,       # reserver max 2 heat
        "rr_main_max": 7,       # vid Rider Replacement (RR)
        "rr_reserve_max": 6,    # vid RR (minst 1 RR-heat krävs)
    },
    "nominations": {
        "heat14_free": True,    # 14: valfritt 2 förare
        "heat15_top2_of_top3": True,  # 15: 2 av lagets 3 poängbästa (inkl bonus)
    },
}




