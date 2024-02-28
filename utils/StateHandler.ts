import TelegramBot from "node-telegram-bot-api";

export class StateHandler {
    private bot: TelegramBot;
    private admin: any;

    constructor(bot: TelegramBot, admin: any) {
        this.bot = bot;
        this.admin = admin;
    }

    public async handleState(msg: any) {
        const chatId = msg.chat.id;
        try {
            const docRef = this.admin.firestore().collection('payments').doc(`${chatId}`);
            let user = await docRef.get();

            if (!user.exists) {
                await this.bot.sendMessage(chatId, `Nemáte zakoupené členství`);
                return;
            }

            const userData = user.data();
            const expiryDate = userData?.expiryDate ? userData.expiryDate.toDate() : null;
            const now = new Date();

            const messages: string[] = [];

            if (userData?.paymentId && userData?.status === "active") {
                let membershipMessage = `Máte zakoupené toto členství: ${userData.paymentId}`;
                if (expiryDate) {
                    const expiryMessage = expiryDate < now ? "Vaše členství již vypršelo!" : `vyprší ${expiryDate.toLocaleDateString()}`;
                    membershipMessage += `, ${expiryMessage}`;
                }
                messages.push(membershipMessage);
            }

            if (userData?.numberOfTickets) {
                const ticketsMessage = `Máte zakoupený tento počet tiketů: ${userData.numberOfTickets}`;
                messages.push(ticketsMessage);
            }

            if (messages.length > 0) {
                console.log(messages.join("\n"));
                await this.bot.sendMessage(chatId, messages.join("\n"));
                return;
            }

            await this.bot.sendMessage(chatId, "Něco se pokazilo, zkuste to prosím znovu");
        } catch (e) {
            console.error(e);
            await this.bot.sendMessage(chatId, "Něco se pokazilo, zkuste to prosím znovu");
        }
    }
}
