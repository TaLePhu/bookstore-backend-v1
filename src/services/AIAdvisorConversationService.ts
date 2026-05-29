import { injectable } from 'tsyringe';
import { AppDataSource } from '@config/data-source';
import { AIAdvisorConversation } from '@entities/AIAdvisorConversation';
import { NotFoundError, ValidationError } from '@utils/errors';

interface SaveConversationInput {
  title?: string;
  messages?: unknown[];
}

const MAX_MESSAGES = 40;
const MAX_CONVERSATIONS = 20;

@injectable()
export class AIAdvisorConversationService {
  private repository = AppDataSource.getRepository(AIAdvisorConversation);

  async list(userId: string): Promise<AIAdvisorConversation[]> {
    return this.repository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: MAX_CONVERSATIONS,
    });
  }

  async create(userId: string, input: SaveConversationInput): Promise<AIAdvisorConversation> {
    const conversation = this.repository.create({
      userId,
      title: this.normalizeTitle(input.title),
      messages: this.normalizeMessages(input.messages),
    });

    return this.repository.save(conversation);
  }

  async update(userId: string, id: string, input: SaveConversationInput): Promise<AIAdvisorConversation> {
    const conversation = await this.repository.findOne({ where: { id, userId } });
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    if (input.title !== undefined) {
      conversation.title = this.normalizeTitle(input.title);
    }

    if (input.messages !== undefined) {
      conversation.messages = this.normalizeMessages(input.messages);
    }

    return this.repository.save(conversation);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await this.repository.delete({ id, userId });
    if ((result.affected ?? 0) === 0) {
      throw new NotFoundError('Conversation not found');
    }
  }

  private normalizeTitle(title?: string): string {
    const trimmed = typeof title === 'string' ? title.trim() : '';
    return (trimmed || 'Cuộc trò chuyện mới').slice(0, 160);
  }

  private normalizeMessages(messages?: unknown[]): unknown[] {
    if (!Array.isArray(messages)) {
      throw new ValidationError('messages must be an array');
    }

    return messages.slice(-MAX_MESSAGES);
  }
}
