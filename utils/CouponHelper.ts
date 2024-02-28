import TelegramBot from "node-telegram-bot-api";
import stripe from "stripe";

export class CouponHelper {
    private bot: TelegramBot;
    private stripe: stripe;

    constructor(bot: TelegramBot, stripe: stripe) {
        this.bot = bot;
        this.stripe = stripe;
    }

    public async applyCoupon(msg: TelegramBot.Message, match: RegExpExecArray | null, userState: { [key: number]: any }) {
        const chatId = msg.chat.id;
        const couponCode = (match ?? [])[1];

        try {
            const stripeCoupon = await this.retrieveCoupon(couponCode);

            if (!stripeCoupon || stripeCoupon.valid === false) {
                return this.bot.sendMessage(chatId, "Tento kupón není validní.");
            }

            this.updateUserState(chatId, couponCode, userState);
            return this.bot.sendMessage(chatId, "Kupón byl aplikován, Vaše další platba bude mít uplatněnou slevu.");
        } catch (error) {
            console.error("Error fetching coupon from Stripe:", error);
            return this.bot.sendMessage(chatId, "Nastala chyba při aplikaci kupónu, zkuse to prosím později.");
        }
    }

    private async retrieveCoupon(couponCode: string) {
        return await this.stripe.coupons.retrieve(couponCode);
    }

    private updateUserState(chatId: string | number, couponCode: any, userState: { [key: number]: any }) {
        if (!userState[chatId]) {
            userState[chatId] = {};
        }
        userState[chatId].coupon = couponCode;
    }
}