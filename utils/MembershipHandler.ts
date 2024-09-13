import TelegramBot from "node-telegram-bot-api";
import { memberships, names } from "../data";

export class MembershipHandler {
    private bot: TelegramBot;
    private admin: any;

    constructor(bot: TelegramBot, admin: any) {
        this.bot = bot;
        this.admin = admin;
    }

    async handleMembership(msg: any, match: any) {
        try {
            const idString: any = (match ?? [])[1];
            const chatId = msg.chat.id;

            if (!idString) {
                this.displayMembershipOptions(chatId);
                return;
            }

            const id = idString.trim();
            const keyWasFound = await this.checkAndUpdateKeys(id, msg);

            if (!keyWasFound) {
                this.bot.sendMessage(msg.chat.id, "Klíč je neplatný!");
            }
        } catch (e) {
            console.log(e);
            this.bot.sendMessage(msg.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
        }
    }

    private displayMembershipOptions(chatId: number) {
        const buttons = memberships.map((membership, index) => [{
            text: names[index],
            callback_data: `invoice:${membership.type}`
        }]);
        this.bot.sendPhoto(chatId, "./images/membership.jpg", {
            caption: "Vyberte si členství:",
            reply_markup: { inline_keyboard: buttons }
        });
    }

    private async checkAndUpdateKeys(id: string, msg: any): Promise<boolean> {
        const chatId = msg.chat.id;
        let keyWasFound = false;

        const updateKeys = async (doc: any, data: string[]) => {
            const index = data.indexOf(id);
            if (index > -1) {
                data.splice(index, 1);
                await doc.ref.update({ keys: data });
                keyWasFound = true;
            }
        };

        const processPayment = async (i: number, user: any) => {
            let updateData: any = {
                userId: chatId,
                userName: `${msg.chat.first_name} ${msg.chat.last_name}`,
                name: msg.chat.username,
                timestamp: new Date(),
            };

            let currentExpiry = user.exists && user.data().expiryDate ? new Date(user.data().expiryDate.toDate()) : new Date();
            currentExpiry < new Date() ? currentExpiry = new Date() : null;
            currentExpiry.setMonth(currentExpiry.getMonth() + 1);

            updateData['paymentId'] = "All In One";
            updateData['expiryDate'] = currentExpiry;

            /* if (i === 2) {
                let currentExpiry = user.exists && user.data().expiryDate ? new Date(user.data().expiryDate.toDate()) : new Date();
                currentExpiry < new Date() ? currentExpiry = new Date() : null;
                currentExpiry.setMonth(currentExpiry.getMonth() + 1);

                updateData['paymentId'] = "All In One";
                updateData['expiryDate'] = currentExpiry;
            } else {
                let numberOfTickets = i === 1 ? 1 : 10;
                numberOfTickets += user.exists && user.data().numberOfTickets ? Number(user.data().numberOfTickets) : 0;
                updateData['numberOfTickets'] = numberOfTickets;
            } */

            await this.admin.firestore().collection('payments').doc(chatId.toString()).set(updateData, { merge: true });
            return updateData;
        };

        for (let i = 1; i <= 3 && !keyWasFound; i++) {
            const doc = await this.admin.firestore().collection('keys').doc(`${i}`).get();
            if (doc.exists && doc.data().keys.includes(id)) {
                await updateKeys(doc, doc.data().keys);

                const userDoc = await this.admin.firestore().collection('payments').doc(chatId.toString()).get();
                const updateData = await processPayment(i, userDoc);

                if (updateData?.paymentId === "All In One") {
                    this.bot.sendMessage(chatId, `Máte zaplacené ${memberships[i - 1].type}. Vaše členství vyprší ${new Date(updateData.expiryDate).toLocaleDateString()}`);
                } else {
                    this.bot.sendMessage(chatId, `Máte zaplacené: ${memberships[i - 1].type}.`);
                }
                let groupChatId = memberships[i - 1].type === 'All In One' || memberships[i - 1].type === 'All In One - 14 dní' ? '-1001929255559' : '-1001829724709';
                const inviteLink = await this.bot.exportChatInviteLink(groupChatId);
                this.bot.sendMessage(chatId, `Děkujeme za platbu! Přidejte se k nám zde: ${inviteLink}, tento link vyprší za 10 minut`);

                setTimeout(() => this.bot.exportChatInviteLink(groupChatId).catch(console.error), 600000);
                break;
            }
        }

        return keyWasFound;
    }
}
