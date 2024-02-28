import TelegramBot from "node-telegram-bot-api";
import stripe from "stripe";

export class UnsubscribeHelper {
    private bot: TelegramBot;
    private admin: any;
    private stripe: stripe;

    constructor(bot: TelegramBot, admin: any, stripe: stripe) {
        this.bot = bot;
        this.admin = admin;
        this.stripe = stripe;
    }

    public async onUnsubscribe(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;

        try {
            const doc = await this.getPaymentDocument(chatId);

            if (!doc.exists || !doc.data()?.subscribeId) {
                this.bot.sendMessage(chatId, "Nemáte aktivní předplatné 'All in One'.");
                return;
            }

            const subscriptionId = doc.data()?.subscribeId;
            await this.cancelSubscription(chatId, subscriptionId);
        } catch (error) {
            console.error("Chyba během odhlášení:", error);
            this.bot.sendMessage(chatId, "Při pokusu o odhlášení došlo k chybě. Zkuste to prosím později.");
        }
    }

    private async getPaymentDocument(chatId: { toString: () => any; }) {
        return await this.admin.firestore().collection('payments').doc(chatId.toString()).get();
    }

    private async cancelSubscription(chatId: TelegramBot.ChatId, subscriptionId: string) {
        if (subscriptionId) {
            await this.stripe.subscriptions.cancel(subscriptionId);
            await this.updatePaymentDocument(chatId);
            this.bot.sendMessage(chatId, "Vaše předplatné 'All in One' bylo úspěšně zrušeno.");
        }
    }

    private async updatePaymentDocument(chatId: { toString: () => any; }) {
        await this.admin.firestore().collection('payments').doc(chatId.toString()).update({
            subscribeId: null,
            status: 'cancelled'
        });
    }
}