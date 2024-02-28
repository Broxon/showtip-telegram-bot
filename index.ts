require('dotenv').config();
process.env["NTBA_FIX_350"] = "1";

import TelegramBot from 'node-telegram-bot-api';
import Stripe from 'stripe';
import * as admin from "firebase-admin";
import { commands, dfMessage, memberships, msg2, names } from './data';
import * as handler from "./utils";

admin.initializeApp({
    credential: admin.credential.cert(require("./key-petal-397812-firebase-adminsdk-t4ys8-4e1d0c7433.json"))
});

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN || '', { polling: true });

const stripe = new Stripe(process.env.STRIPE_TOKEN || "");

const membershipHandler = new handler.MembershipHandler(bot, admin);
const stateHandler = new handler.StateHandler(bot, admin);
const keyGenHandler = new handler.KeyGenHandler(bot, admin);
const callbackQueryHandler = new handler.CallbackQueryHandler(bot, admin, stripe);
const unsubscribeHelper = new handler.UnsubscribeHelper(bot, admin, stripe);
const couponHelper = new handler.CouponHelper(bot, stripe);

bot.on("error", msg => console.log('[bot] error', msg))
bot.on('polling_error', msg => console.log(`[bot] polling_error:`, msg))
bot.on('webhook_error', msg => console.log(`[bot] webhook_error:`, msg))

bot.setMyCommands(commands)

bot.onText(/\/start/, (msg) => {
    try {
        const chatId = msg.chat.id;
        const buttons = memberships.map((name, index) => [{ text: names[index], callback_data: `membership:${name.type}` }])
        bot.sendMessage(chatId, dfMessage + msg2, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: buttons }
        });
    } catch (error) {
        bot.sendMessage(msg.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Tady máte seznam příkazů:\n\n${commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n')}\n\n\nV případě problémů kontaktujte podpora@showtip.cz nebo nás kontaktujte na Instagramu @showtip.cz`);
});

bot.onText(/\/clenstvi( .+)?/, async (msg, match) => membershipHandler.handleMembership(msg, match));

bot.onText(/\/stav/, async (msg) => stateHandler.handleState(msg));

bot.onText(/\/keygen (.+)/, async (msg, match) => keyGenHandler.generateKey(msg, match));

bot.on('callback_query', async (query) => callbackQueryHandler.handleCallbackQuery(query));

bot.onText(/\/unsubscribe/, async (msg) => unsubscribeHelper.onUnsubscribe(msg));

bot.onText(/\/apply_coupon (.+)/, async (msg, match) => couponHelper.applyCoupon(msg, match, callbackQueryHandler.getUserState));

bot.on('pre_checkout_query', (query) => {
    bot.answerPreCheckoutQuery(query.id, true)
});

console.log('Bot is running...')