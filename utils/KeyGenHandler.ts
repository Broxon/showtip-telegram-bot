import TelegramBot from 'node-telegram-bot-api';
import { v4 as uuidv4 } from 'uuid';

export class KeyGenHandler {
  private bot: TelegramBot;
  private admin: any;
  private allowedUsers = ["Broxoncz", "Aurelicos", "prosteg"];

  constructor(bot: any, admin: any) {
    this.bot = bot;
    this.admin = admin;
  }

  public async generateKey(msg: any, match: any): Promise<void> {
    try {
      if (!this.allowedUsers.includes(msg.chat.username)) {
        return;
      }

      const chatId = this.parseChatId(match);
      if (chatId === null) {
        this.sendMessage(msg.chat.id, "Musíte zadat číslo členství");
        return;
      }

      const uuid = uuidv4();
      await this.updateKeysInFirestore(chatId, uuid);
      this.sendMessage(msg.chat.id, `Klíč byl úspěšně vygenerován: ${uuid}`);
    } catch (e) {
      console.error(e);
      this.sendMessage(msg.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
  }

  private parseChatId(match: any): number | null {
    const text = (match ?? [])[1];
    const chatId = parseInt(text);
    return isNaN(chatId) ? null : chatId;
  }

  private async updateKeysInFirestore(chatId: number, uuid: string): Promise<void> {
    const docRef = this.admin.firestore().collection('keys').doc(`${chatId}`);
    const doc = await docRef.get();

    if (doc.exists && doc.data().keys) {
      const keys = doc.data().keys;
      keys.push(uuid);
      await docRef.set({ keys }, { merge: true });
    } else {
      await docRef.set({ keys: [uuid] }, { merge: true });
    }
  }

  private async sendMessage(chatId: number, message: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error(error);
    }
  }
}
