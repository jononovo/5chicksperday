import { MOCK_ACTIVE_CONTACTS, MOCK_EMAIL_THREADS } from "../mock/emailData";
import type { Contact } from "@shared/schema";

// Email provider interface - will be implemented by different email services
export interface EmailProvider {
  getActiveContacts(userId: number): Promise<any[]>;
  getThreadsByContact(contactId: number, userId: number): Promise<any[]>;
  getThreadWithMessages(threadId: number, userId: number): Promise<any>;
  createThread(data: any): Promise<any>;
  createMessage(data: any): Promise<any>;
  markThreadAsRead(threadId: number): Promise<void>;
}

// Mock email provider for development/testing
export class MockEmailProvider implements EmailProvider {
  async getActiveContacts(userId: number) {
    return MOCK_ACTIVE_CONTACTS.filter(contact => contact.userId === userId);
  }

  async getThreadsByContact(contactId: number, userId: number) {
    return MOCK_EMAIL_THREADS
      .filter(thread => thread.contactId === contactId && thread.userId === userId)
      .map(thread => ({
        id: thread.id,
        contactId: thread.contactId,
        userId: thread.userId,
        subject: thread.subject,
        lastUpdated: thread.lastUpdated,
        createdAt: thread.createdAt,
        isArchived: thread.isArchived
      }));
  }

  async getThreadWithMessages(threadId: number, userId: number) {
    const thread = MOCK_EMAIL_THREADS.find(t => t.id === threadId && t.userId === userId);
    
    if (!thread) {
      return null;
    }
    
    return {
      thread: {
        id: thread.id,
        contactId: thread.contactId,
        userId: thread.userId,
        subject: thread.subject,
        lastUpdated: thread.lastUpdated,
        createdAt: thread.createdAt,
        isArchived: thread.isArchived
      },
      messages: thread.messages
    };
  }

  async createThread(data: any) {
    // In a real implementation, this would add to the database
    // For mock, we'll just return a new thread with the data
    return {
      id: Date.now(),
      ...data,
      createdAt: new Date(),
      lastUpdated: new Date(),
      isArchived: false
    };
  }

  async createMessage(data: any) {
    // In a real implementation, this would add to the database
    // For mock, we'll just return a new message with the data
    return {
      id: Date.now(),
      ...data,
      timestamp: new Date(),
      isRead: data.direction === "outbound" // Outbound messages are read by default
    };
  }

  async markThreadAsRead(threadId: number) {
    // In a real implementation, this would update messages in the database
    // For mock, we'll just log that the action was performed
    console.log(`Marked thread ${threadId} as read (mock)`);
  }
}

// Gmail provider - real implementation
import { google, gmail_v1 } from 'googleapis';
import { storage } from '../storage';
import type { Contact } from "@shared/schema";

export class GmailProvider implements EmailProvider {
  private accessToken: string;
  private userId: number;
  private gmail: gmail_v1.Gmail;
  
  constructor(accessToken: string, userId: number) {
    this.accessToken = accessToken;
    this.userId = userId;
    
    // Create an OAuth2 client with the access token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken
    });
    
    // Create the Gmail client
    this.gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client
    });
  }
  
  // Helper to convert Gmail message format to our internal format
  private async parseGmailMessage(message: gmail_v1.Schema$Message, threadId: number) {
    // Parse the Gmail message payload
    const headers = message.payload?.headers || [];
    const from = headers.find(h => h.name === 'From')?.value || '';
    const to = headers.find(h => h.name === 'To')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    
    // Parse email addresses and names
    const fromMatch = from.match(/(.+) <(.+)>/) || [null, from, from];
    const toMatch = to.match(/(.+) <(.+)>/) || [null, to, to];
    
    const fromName = fromMatch[1] || '';
    const fromEmail = fromMatch[2] || '';
    const toName = toMatch[1] || '';
    const toEmail = toMatch[2] || '';
    
    // Get message body
    let content = '';
    if (message.payload?.body?.data) {
      // Decode base64 content
      content = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      // Check for multipart content
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          content = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
    }
    
    // Determine direction based on sender
    const userEmail = await this.getUserEmail();
    const direction = fromEmail === userEmail ? 'outbound' : 'inbound';
    const timestamp = new Date(parseInt(message.internalDate || '0'));
    
    return {
      id: parseInt(message.id || '0'),
      threadId,
      from: fromName,
      fromEmail,
      to: toName,
      toEmail,
      content,
      timestamp,
      isRead: !message.labelIds?.includes('UNREAD'),
      direction
    };
  }
  
  // Helper to get the user's email address
  private async getUserEmail() {
    try {
      const response = await this.gmail.users.getProfile({
        userId: 'me'
      });
      
      return response.data.emailAddress || '';
    } catch (error) {
      console.error('Error getting user email:', error);
      return '';
    }
  }
  
  // Helper to find contact by email
  private async findContactByEmail(email: string) {
    try {
      // Get all contacts for the user
      const contacts = await storage.listContacts(this.userId);
      
      // Find contact with matching email
      return contacts.find(contact => contact.email === email);
    } catch (error) {
      console.error('Error finding contact by email:', error);
      return undefined;
    }
  }
  
  // Get contacts with recent email threads
  async getActiveContacts(userId: number) {
    try {
      // 1. Get all contacts for the user
      const contacts = await storage.listContacts(userId);
      
      // 2. Get recent threads from Gmail
      const response = await this.gmail.users.threads.list({
        userId: 'me',
        maxResults: 50, // Get recent threads
        q: 'is:sent OR is:inbox' // Get both sent and received emails
      });
      
      const threads = response.data.threads || [];
      const activeContacts: any[] = [];
      
      // Create a mapping of email to contact
      const emailContactMap = new Map();
      contacts.forEach(contact => {
        if (contact.email) {
          emailContactMap.set(contact.email.toLowerCase(), contact);
        }
      });
      
      // Process each thread to find contacts
      for (const thread of threads) {
        // Get full thread data
        const threadData = await this.gmail.users.threads.get({
          userId: 'me',
          id: thread.id || ''
        });
        
        // Skip threads without messages
        if (!threadData.data.messages || threadData.data.messages.length === 0) {
          continue;
        }
        
        // Get the latest message in the thread
        const latestMessage = threadData.data.messages[threadData.data.messages.length - 1];
        
        // Parse headers to get from/to
        const headers = latestMessage.payload?.headers || [];
        const fromHeader = headers.find(h => h.name === 'From')?.value || '';
        const toHeader = headers.find(h => h.name === 'To')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        
        // Extract email addresses
        const fromMatch = fromHeader.match(/<(.+?)>/) || [null, fromHeader];
        const fromEmail = fromMatch[1]?.toLowerCase();
        
        const toMatch = toHeader.match(/<(.+?)>/) || [null, toHeader];
        const toEmail = toMatch[1]?.toLowerCase();
        
        // Get message content
        let content = '';
        if (latestMessage.payload?.body?.data) {
          content = Buffer.from(latestMessage.payload.body.data, 'base64').toString();
        } else if (latestMessage.payload?.parts) {
          for (const part of latestMessage.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              content = Buffer.from(part.body.data, 'base64').toString();
              break;
            }
          }
        }
        
        // Find matching contact 
        let contact = null;
        const userEmail = await this.getUserEmail();
        const isOutbound = fromEmail === userEmail.toLowerCase();
        
        // For outbound messages, the contact is the recipient
        // For inbound messages, the contact is the sender
        const contactEmail = isOutbound ? toEmail : fromEmail;
        
        if (contactEmail && emailContactMap.has(contactEmail)) {
          contact = emailContactMap.get(contactEmail);
          
          // If we haven't added this contact yet, add them to active contacts
          if (contact && !activeContacts.some(c => c.id === contact.id)) {
            const timestamp = new Date(parseInt(latestMessage.internalDate || '0'));
            const isUnread = latestMessage.labelIds?.includes('UNREAD') || false;
            
            activeContacts.push({
              ...contact,
              lastMessage: content.substring(0, 100), // Truncate long messages
              lastMessageDate: timestamp,
              unread: isUnread && !isOutbound // Only inbound can be unread
            });
          }
        }
      }
      
      // Sort by last message date (newest first)
      return activeContacts.sort((a, b) => 
        b.lastMessageDate.getTime() - a.lastMessageDate.getTime()
      );
    } catch (error) {
      console.error('Error getting active contacts from Gmail:', error);
      return [];
    }
  }
  
  // Get email threads for a specific contact
  async getThreadsByContact(contactId: number, userId: number) {
    try {
      // 1. Get the contact details
      const contact = await storage.getContact(contactId, userId);
      
      if (!contact || !contact.email) {
        throw new Error('Contact not found or has no email');
      }
      
      // 2. Search Gmail for threads with this contact
      const response = await this.gmail.users.threads.list({
        userId: 'me',
        q: `from:${contact.email} OR to:${contact.email}`,
        maxResults: 20
      });
      
      const threads = response.data.threads || [];
      const threadResults = [];
      
      // 3. Process each thread
      for (const thread of threads) {
        // Get full thread data
        const threadData = await this.gmail.users.threads.get({
          userId: 'me',
          id: thread.id || ''
        });
        
        // Skip threads without messages
        if (!threadData.data.messages || threadData.data.messages.length === 0) {
          continue;
        }
        
        // Get the first message for subject
        const firstMessage = threadData.data.messages[0];
        const headers = firstMessage.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        
        // Get the latest message for timestamp
        const latestMessage = threadData.data.messages[threadData.data.messages.length - 1];
        const timestamp = new Date(parseInt(latestMessage.internalDate || '0'));
        
        // Check if any message is unread
        const hasUnread = threadData.data.messages.some(
          msg => msg.labelIds?.includes('UNREAD')
        );
        
        threadResults.push({
          id: parseInt(thread.id || '0'),
          contactId,
          userId,
          subject,
          lastUpdated: timestamp,
          createdAt: new Date(parseInt(firstMessage.internalDate || '0')),
          isArchived: false,
          hasUnread
        });
      }
      
      // Sort by last updated (newest first)
      return threadResults.sort((a, b) => 
        b.lastUpdated.getTime() - a.lastUpdated.getTime()
      );
    } catch (error) {
      console.error('Error getting threads from Gmail:', error);
      return [];
    }
  }
  
  // Get a specific thread with all its messages
  async getThreadWithMessages(threadId: number, userId: number) {
    try {
      // 1. Get thread data from Gmail
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId.toString()
      });
      
      if (!response.data.messages || response.data.messages.length === 0) {
        return null;
      }
      
      // 2. Parse the first message for thread details
      const firstMessage = response.data.messages[0];
      const headers = firstMessage.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      
      // 3. Parse all messages
      const messages = [];
      
      for (const message of response.data.messages) {
        messages.push(await this.parseGmailMessage(message, threadId));
      }
      
      // 4. Find the contact
      let contactId = 0;
      
      if (messages.length > 0) {
        const userEmail = await this.getUserEmail();
        const contactEmail = messages[0].fromEmail === userEmail 
          ? messages[0].toEmail 
          : messages[0].fromEmail;
          
        const contact = await this.findContactByEmail(contactEmail);
        contactId = contact?.id || 0;
      }
      
      // 5. Create the thread object
      const thread = {
        id: threadId,
        contactId,
        userId,
        subject,
        lastUpdated: new Date(parseInt(response.data.messages[response.data.messages.length - 1].internalDate || '0')),
        createdAt: new Date(parseInt(firstMessage.internalDate || '0')),
        isArchived: false
      };
      
      return {
        thread,
        messages
      };
    } catch (error) {
      console.error('Error getting thread from Gmail:', error);
      return null;
    }
  }
  
  // Create a new thread (sends first message)
  async createThread(data: any) {
    try {
      // 1. Create the email content
      const userEmail = await this.getUserEmail();
      const contact = await storage.getContact(data.contactId, data.userId);
      
      if (!contact || !contact.email) {
        throw new Error('Contact not found or has no email');
      }
      
      // 2. Create the raw email content
      const email = [
        `From: ${userEmail}`,
        `To: ${contact.email}`,
        `Subject: ${data.subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        data.initialMessage || '' // Initial message content
      ].join('\r\n');
      
      // 3. Send the email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(email).toString('base64url')
        }
      });
      
      // 4. Return the thread data
      return {
        id: parseInt(response.data.threadId || '0'),
        contactId: data.contactId,
        userId: data.userId,
        subject: data.subject,
        lastUpdated: new Date(),
        createdAt: new Date(),
        isArchived: false
      };
    } catch (error) {
      console.error('Error creating thread in Gmail:', error);
      throw new Error('Failed to create email thread');
    }
  }
  
  // Send a message in an existing thread
  async createMessage(data: any) {
    try {
      // 1. Get thread details to ensure we have the right subject
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: data.threadId.toString()
      });
      
      if (!response.data.messages || response.data.messages.length === 0) {
        throw new Error('Thread not found');
      }
      
      // 2. Get the original email details
      const firstMessage = response.data.messages[0];
      const headers = firstMessage.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      
      // 3. Get user and contact emails
      const userEmail = await this.getUserEmail();
      
      // 4. Create the raw email content
      const email = [
        `From: ${userEmail}`,
        `To: ${data.toEmail}`,
        `Subject: ${subject}`,
        `In-Reply-To: ${response.data.messages[0].id}`,
        `References: ${response.data.messages[0].id}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        data.content
      ].join('\r\n');
      
      // 5. Send the email as a reply in the thread
      const sendResponse = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(email).toString('base64url'),
          threadId: data.threadId.toString()
        }
      });
      
      // 6. Return the message data
      return {
        id: parseInt(sendResponse.data.id || '0'),
        threadId: data.threadId,
        from: 'me',
        fromEmail: userEmail,
        to: data.toName,
        toEmail: data.toEmail,
        content: data.content,
        timestamp: new Date(),
        isRead: true, // Outbound messages are always read
        direction: 'outbound'
      };
    } catch (error) {
      console.error('Error sending message in Gmail:', error);
      throw new Error('Failed to send email message');
    }
  }
  
  // Mark thread messages as read
  async markThreadAsRead(threadId: number) {
    try {
      // 1. Get the thread
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId.toString()
      });
      
      if (!response.data.messages) {
        return;
      }
      
      // 2. Find unread messages
      const unreadMessages = response.data.messages.filter(
        msg => msg.labelIds?.includes('UNREAD')
      );
      
      if (unreadMessages.length === 0) {
        return; // No unread messages
      }
      
      // 3. Remove the UNREAD label from all messages
      await this.gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: unreadMessages.map(msg => msg.id || ''),
          removeLabelIds: ['UNREAD']
        }
      });
      
      console.log(`Marked ${unreadMessages.length} messages as read in thread ${threadId}`);
    } catch (error) {
      console.error('Error marking thread as read in Gmail:', error);
    }
  }
}

// Factory to get appropriate email provider based on environment and user settings
export function getEmailProvider(userId: number, accessToken?: string): EmailProvider {
  // If we have a Gmail access token, use the Gmail provider
  if (accessToken) {
    console.log(`Using Gmail provider for user ${userId}`);
    return new GmailProvider(accessToken, userId);
  } else {
    console.log(`Using mock email provider for user ${userId} (no Gmail token available)`);
    return new MockEmailProvider();
  }
}