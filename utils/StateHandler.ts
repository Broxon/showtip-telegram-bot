import TelegramBot from "node-telegram-bot-api";
import Stripe from "stripe";

export class StateHandler {
    private bot: TelegramBot;
    private admin: any;
    private stripe: Stripe;

    constructor(bot: TelegramBot, admin: any, stripe: Stripe) {
        this.bot = bot;
        this.admin = admin;
        this.stripe = stripe;
    }

    public async handleState(msg: any) {
        const chatId = msg.chat.id;
        try {
            const docRef = this.admin.firestore().collection('payments').doc(`${chatId}`);
            let userDoc = await docRef.get();

            if (!userDoc.exists) {
                await this.bot.sendMessage(chatId, `Nemáte zakoupené členství`);
                return;
            }

            const userData = userDoc.data();
            const now = new Date();

            let subEnd: Date | null = null;

            if (userData?.subscribeId) {
                const subscription = await this.stripe.subscriptions.retrieve(userData.subscribeId);
                subEnd = new Date(subscription.current_period_end * 1000);

                if (subscription.status === 'active') {
                    await docRef.update({
                        expiryDate: this.admin.firestore.Timestamp.fromDate(subEnd)
                    });
                    userData.expiryDate = this.admin.firestore.Timestamp.fromDate(subEnd);
                }
            }

            const messages: string[] = [];
            if (userData?.paymentId && userData?.status === "active") {
                let membershipMessage = `Máte zakoupené toto členství: ${userData.paymentId}`;
                if (subEnd) {
                    const expiryMessage = subEnd < now ? "Vaše členství již vypršelo!" : `vyprší ${subEnd.toLocaleDateString()}`;
                    membershipMessage += `, ${expiryMessage}`;
                }
                messages.push(membershipMessage);
            }

            if (userData?.numberOfTickets) {
                messages.push(`Máte zakoupený tento počet tiketů: ${userData.numberOfTickets}`);
            }

            if (messages.length > 0) {
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
