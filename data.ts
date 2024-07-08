interface Command {
    command: string;
    description: string;
}

export const commands: Command[] = [
    { command: "start", description: "Spustí bota" },
    { command: "help", description: "Vypíše příkazy" },
    { command: "clenstvi", description: "Vypíše druhy členství" },
    { command: "stav", description: "Vypíše stav členství" },
    { command: "apply_coupon", description: "Použije kupón" },
    { command: "unsubscribe", description: "Zrušit členství" }
];

export const memberships = [
    { type: "Základní členství", price: 3000, description: "Základní balíček pro jeden tiket", id: "price_1OLqXsIKOPne52YOC2tr3F0j", mode: "payment" },
    { type: "All In One", price: 0, description: "Členství na měsíc", id: "price_1OLqUdIKOPne52YOJVyQpP4c", mode: "subscription" }
];

export const names = [
    "JEDNOTNÝ TIKET 🔥, 3000 CZK/TIKET",
    "All IN ONE 🍀, 1500 CZK/ MĚSÍC",
];

export const paymentNames = [
    {
        name: "💳 Kreditní/Debetní karta",
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

export const dfMessage = `<b>Vítej!</b>&#10;&#10;Jsem tvůj osobní asistent při výběru členství. &#10;&#10;Pojď si s námi <b>přivydělat</b> <b>sázením!!</b>🤑 &#10;&#10;<b>******************************</b>&#10;&#10;<a href="showtip.cz"><b>Showtip.cz</b></a>&#10;&#10;<b>******************************</b> &#10;&#10;`
export const msg2 = 'Vyber si prosím<b> svůj </b> plán předplatného:';
