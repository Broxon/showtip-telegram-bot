import TelegramBot from "node-telegram-bot-api";
import { dfMessage, memberships, msg2, names, paymentNames } from "../data";

export class CallbackQueryHandler {
    private bot: TelegramBot;
    private admin: any;
    private stripe: any;
    private userStates: { [key: number]: any } = {};

    constructor(bot: any, admin: any, stripe: any) {
        this.bot = bot;
        this.admin = admin;
        this.stripe = stripe;
    }

    get getUserState(): { [key: number]: any; } {
        return this.userStates;
    }

    public async handleCallbackQuery(query: any): Promise<void> {
        const message = query.message;

        try {
            const data = query.data;
            switch (true) {
                case data.startsWith('membership:'):
                    await this.handleMembershipSelection(message, data);
                    break;
                case data === 'credit_card' || data.startsWith("invoice"):
                    await this.handlePayment(message, data);
                    break;
                case data === 'access_code':
                    await this.bot.sendMessage(message.chat.id, "Zadejte kód, pomocí příkazu členství ve tvaru: /clenstvi <kód>");
                    break;
                case data === 'back_to_membership':
                    await this.handleBackToMembership(message);
                    break;
                default:
                    console.log('Unhandled data:', data);
            }
        } catch (e) {
            console.error(e);
            await this.bot.sendMessage(message.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
        }
    }

    private async handleMembershipSelection(message: any, data: string): Promise<void> {
        const selectedType = data.split(':')[1];
        this.setUserState(message.chat.id, 'type', selectedType);
        const paymentButtons = paymentNames.map(payment => [{ text: payment.name, callback_data: payment.type }]);
        await this.bot.editMessageText(`${dfMessage}Vyberte si jednu z následujících možností:`, {
            chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: paymentButtons }, parse_mode: "HTML", disable_web_page_preview: true,
        });
    }

    private async handlePayment(message: any, data: string): Promise<any> {
        if (data?.startsWith("invoice")) {
            const selectedType = data!.split(':')[1];
            if (!this.userStates[message!.chat.id]) {
                this.userStates[message!.chat.id] = {};
            }
            this.userStates[message!.chat.id].type = selectedType;
        }
        const userState = this.userStates[message!.chat.id];
        if (!userState || typeof userState.type === 'undefined') {
            this.bot.sendMessage(message!.chat.id, "Nejprve vyberte členství");
            return;
        }
        const payment = memberships.find(m => m.type === userState.type);
        if (!payment) return;

        const chatId = message!.chat.id;
        const price_id = payment.id;
        let sessionParams: any = {
            payment_method_types: ['card'],
            metadata: {
                telegramChatId: chatId,
                label: payment.type,
                userName: `${message!.chat.first_name} ${message!.chat.last_name}`,
                userId: chatId,
            },
            line_items: [{
                price: `${price_id}`,
                quantity: 1,
            }],
            mode: `${payment.mode}`,
            success_url: `https://europe-west1-key-petal-397812.cloudfunctions.net/payment?session_id={CHECKOUT_SESSION_ID}`,
        };
/* 
        if (payment.mode === 'subscription') {
            sessionParams.subscription_data = {
                trial_period_days: 3,
            };
        }  */

        if (userState.coupon && userState.type === 'All In One') {
            try {
                const stripeCoupon = await this.stripe.coupons.retrieve(userState.coupon);
                if (stripeCoupon && stripeCoupon.valid) {
                    sessionParams.discounts = [{ coupon: stripeCoupon.id }];
                } else {
                    throw new Error('Invalid coupon');
                }
            } catch (error) {
                console.error("Error applying coupon:", error);
                return this.bot.sendMessage(chatId, "Nastala chyba při aplikaci kupónu, zkontrolujte kód kupónu.");
            }
        }

        try {
            const session = await this.stripe.checkout.sessions.create(sessionParams);
            this.bot.sendMessage(chatId, `Prosím zaplaťte přes tento link: [Platba](${session.url})\nPři zaplacení souhlasíte s našimi [podmínkami](https://www.showtip.cz/obchodni-podminky).`, { parse_mode: "Markdown" });
        } catch (error) {
            console.error("Error creating Stripe session:", error);
            this.bot.sendMessage(chatId, "Nastala chyba při vytváření platebního linku, zkuse to prosím znovu.");
        }

        return;
    }

    private async handleBackToMembership(message: any): Promise<void> {
        const buttons = memberships.map((membership, index) => [{ text: names[index], callback_data: `membership:${membership.type}` }]);
        await this.bot.editMessageText(dfMessage + msg2, {
            chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: buttons }, parse_mode: "HTML",
            disable_web_page_preview: true,
        });
    }

    private setUserState(chatId: number, key: string, value: any): void {
        if (!this.userStates[chatId]) {
            this.userStates[chatId] = {};
        }
        this.userStates[chatId][key] = value;
    }
}
