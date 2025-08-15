# helpers/schedule_elit.py
# (B/V/R/G + siffra 1..7 per gate)
ELITSERIEN_2_15_7 = [
    # heat,  gate1, gate2, gate3, gate4
    ( 1,  "B2",  "V1",  "R1",  "G2"),
    ( 2,  "G7",  "R6",  "V6",  "B7"),
    ( 3,  "R3",  "V3",  "B4",  "G4"),
    ( 4,  "V5",  "B5",  "G7",  "R6"),
    # Banunderhåll
    ( 5,  "B7",  "G4",  "R2",  "V6"),
    ( 6,  "G2",  "R3",  "V1",  "B4"),
    ( 7,  "G4",  "R1",  "V3",  "B2"),
    # Banunderhåll
    ( 8,  "B4",  "G7",  "R3",  "V5"),
    ( 9,  "B5",  "G2",  "R6",  "V1"),
    (10,  "V6",  "B7",  "G5",  "R1"),
    # Banunderhåll & paus
    (11,  "V3",  "B4",  "G2",  "R5"),
    (12,  "V1",  "B2",  "G4",  "R3"),
    (13,  "R1",  "G5",  "B5",  "V3"),
    # 14 och 15 är nomineringar (färgmönster anges: V/R, R/V etc) – riders bestäms efter heat 13
    (14,  "V/R", "V/R", "G/B", "G/B"),
    (15,  "R/V", "R/V", "B/G", "B/G"),
]

COLOR_TO_TEAM = {
    "R": "home",  # röd
    "B": "home",  # blå
    "G": "away",  # gul
    "V": "away",  # vit
}

COLOR_TO_HELMET = {
    "R": "#DC2626",
    "B": "#2563EB",
    "G": "#FACC15",
    "V": "#FFFFFF",
}