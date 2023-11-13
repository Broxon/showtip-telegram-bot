interface Command {
    command: string;
    description: string;
}

export const commands: Command[] = [
    { command: "start", description: "Spustí bota" },
    { command: "help", description: "Vypíše příkazy" },
    { command: "clenstvi", description: "Vypíše druhy členství" },
    { command: "stav", description: "Vypíše stav členství" }
];

export const memberships = [
    { type: "Základní členství", price: 3000, description: "Základní balíček pro jeden tiket" },
    { type: "All In One", price: 4000, description: "Členství na měsíc" },
    { type: "Revolutio", price: 27000, description: "Revolutio členství na měsíc" }
];

export const names = [
    "JEDNOTNÝ TIKET 🔥, 3000 CZK/TIKET",
    "All IN ONE 🏆, 4000 CZK/MĚSÍC",
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
