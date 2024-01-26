interface Command {
    command: string;
    description: string;
}

export const commands: Command[] = [
    { command: "start", description: "Spustí bota" },
    { command: "help", description: "Vypíše příkazy" },
    { command: "clenstvi", description: "Vypíše druhy členství" },
    { command: "stav", description: "Vypíše stav členství" },
    { command: "apply_coupon", description: "Použije kupón" }
];

export const memberships = [
    { type: "Základní členství", price: 3000, description: "Základní balíček pro jeden tiket", id: "price_1OLqXsIKOPne52YOC2tr3F0j", mode: "payment" },
    { type: "All In One", price: 2000, description: "Členství na měsíc", id: "price_1OVfeEIKOPne52YOgHiAzq1f", mode: "subscription" },
    { type: "Revolutio", price: 27000, description: "Nejlepší členství, garance vrácení peněz", id: "price_1OLqXLIKOPne52YOLu50Yh7J", mode: "payment" }
];

export const names = [
    "JEDNOTNÝ TIKET 🔥, 3000 CZK/TIKET",
    "All IN ONE 🏆, 2000 CZK/MĚSÍC",
    "REVOLUTIO 👑, 27000 CZK/10 TIKETŮ"
];

export const paymentNames = [
    {
        name: "💳 Kreditní/Debitní karta",
        type: "credit_card"
    },
    {
        name: "🔑 Přístupový kód ",
        type: "access_code"
    },
    {
        name: "« Zpět",
        type: "back_to_membership"
    }
]
