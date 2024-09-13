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
    { type: "All In One", price: 0, description: "Členství na měsíc", id: "price_1OLqUdIKOPne52YOJVyQpP4c", mode: "subscription" },
    { type: "All In One - 14 dní", price: 0, description: "Členství na 14 dní", id: "price_1PyfG7IKOPne52YOPuDxjX5E", mode: "subscription" }
];

export const names = [
    "ALL IN ONE + INFOTIPY 🍀, 1500 CZK/ MĚSÍC",
    "ALL IN ONE 🍀, 800 CZK/ 14-DNÍ",
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

export const dfMessage = `<b>Ahoj!</b>&#10;&#10;Jsem tvůj osobní asistent při výběru členství. &#10;&#10;Pojď si s námi <b>přivydělat</b> <b>sázením!!</b>🤑 &#10;&#10;<b>******************************</b>&#10;&#10;<a href="showtip.cz"><b>Showtip.cz</b></a>&#10;&#10;<b>******************************</b> &#10;&#10;`
export const msg2 = 'Vyber si prosím<b> svůj plán předplatného:</b>';
