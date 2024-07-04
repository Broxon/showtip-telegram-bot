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
    "All IN ONE 🏆, 0 CZK/3 DNY",
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

export const dfMessage = `<b>Vítejte!</b>&#10;&#10;Jsem váš osobní asistent pro členství v klubu. &#10;&#10;Pojďte s námi <b>vydělat</b> a získejte finanční <b>svobodu!!</b>🤑 &#10;&#10;<b>******************************</b>&#10;&#10;<a href="showtip.cz"><b>Showtip.cz</b></a>&#10;&#10;<b>******************************</b> &#10;&#10;`
export const msg2 = 'Vyberte si jeden z následujících <b> balíčků </b>. Existují 3 úrovně, proto vyberte ten, který Vám nejvíce vyhovuje';
