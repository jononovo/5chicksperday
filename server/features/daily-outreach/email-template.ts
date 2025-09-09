import { Contact, Company } from "@shared/schema";

interface EmailCard {
  contact: Contact;
  company: Company | null;
  subject: string;
  content: string;
  emailAddress: string;
  outreachUrl: string;
}

export class EmailTemplateService {
  static generateDailyOutreachEmail(
    cards: EmailCard[],
    recipientName: string,
    dayOfWeek: string,
    date: string
  ): { subject: string; html: string; text: string } {
    const subject = `🚀 Your ${dayOfWeek} Outreach: 5 Contacts Ready to Go!`;
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily Outreach</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                🦆 5Ducks Daily Outreach
              </h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px; line-height: 1.5;">
                ${dayOfWeek}, ${date}
              </p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                Good morning${recipientName ? `, ${recipientName}` : ''}! 👋
              </p>
              <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
                Here are your 5 handpicked contacts for today's outreach. Each message has been personalized and is ready to send!
              </p>
            </td>
          </tr>
          
          <!-- Contact Cards -->
          ${cards.map((card, index) => `
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <table role="presentation" style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <!-- Card Header -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="vertical-align: top;">
                          <div style="display: inline-block; background-color: #6366f1; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-weight: 600; font-size: 14px;">
                            ${index + 1}
                          </div>
                        </td>
                        <td style="padding-left: 15px; vertical-align: top;">
                          <h3 style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">
                            ${card.contact.name || 'Contact'}
                          </h3>
                          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
                            ${card.contact.role || 'Decision Maker'} ${card.company ? `at ${card.company.name}` : ''}
                          </p>
                          ${card.contact.email ? `
                          <p style="margin: 4px 0 0 0; color: #4b5563; font-size: 13px;">
                            📧 ${card.contact.email}
                          </p>
                          ` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Email Preview -->
                <tr>
                  <td style="padding: 20px;">
                    <div style="background-color: #f3f4f6; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Subject Line
                      </p>
                      <p style="margin: 0; color: #1f2937; font-size: 14px; font-weight: 500; line-height: 1.4;">
                        ${card.subject}
                      </p>
                    </div>
                    
                    <div style="background-color: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px 15px; border-radius: 4px; margin-bottom: 20px;">
                      <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                        <strong>Preview:</strong> ${card.content.substring(0, 150)}${card.content.length > 150 ? '...' : ''}
                      </p>
                    </div>
                    
                    <!-- Action Buttons -->
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding-right: 10px; width: 50%;">
                          <a href="${card.outreachUrl}" style="display: block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center;">
                            ✉️ Send Email
                          </a>
                        </td>
                        <td style="padding-left: 10px; width: 50%;">
                          <a href="${card.outreachUrl}" style="display: block; background-color: #ffffff; color: #6366f1; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center; border: 2px solid #6366f1;">
                            👁️ View Details
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}
          
          <!-- Tips Section -->
          <tr>
            <td style="padding: 20px 30px; background-color: #eff6ff; border-top: 1px solid #dbeafe;">
              <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
                💡 Today's Outreach Tips
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #3730a3; font-size: 14px; line-height: 1.6;">
                <li style="margin-bottom: 8px;">Personalize the opening line with something specific about their company</li>
                <li style="margin-bottom: 8px;">Keep your message concise - aim for 50-125 words</li>
                <li style="margin-bottom: 8px;">End with a clear, low-commitment call-to-action</li>
                <li>Follow up in 3-4 days if you don't hear back</li>
              </ul>
            </td>
          </tr>
          
          <!-- Quick Access Button -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <a href="${process.env.BASE_URL || 'https://5ducks.com'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                🚀 Access Your Dashboard
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                You're receiving this because you have daily outreach enabled.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                <a href="${process.env.BASE_URL || 'https://5ducks.com'}/account" style="color: #6366f1; text-decoration: none;">Manage preferences</a> 
                • 
                <a href="${process.env.BASE_URL || 'https://5ducks.com'}/support" style="color: #6366f1; text-decoration: none;">Get help</a>
              </p>
              <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 12px;">
                © 2025 5Ducks. Making B2B prospecting delightful.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Generate plain text version
    const text = `
Your ${dayOfWeek} Outreach: 5 Contacts Ready to Go!
=====================================================

Good morning${recipientName ? `, ${recipientName}` : ''}!

Here are your 5 handpicked contacts for today's outreach:

${cards.map((card, index) => `
${index + 1}. ${card.contact.name || 'Contact'}
   ${card.contact.role || 'Decision Maker'} ${card.company ? `at ${card.company.name}` : ''}
   Email: ${card.contact.email || 'Not available'}
   
   Subject: ${card.subject}
   
   Message Preview:
   ${card.content.substring(0, 200)}${card.content.length > 200 ? '...' : ''}
   
   Send Email: ${card.outreachUrl}
   
---`).join('\n')}

Today's Outreach Tips:
• Personalize the opening line with something specific about their company
• Keep your message concise - aim for 50-125 words  
• End with a clear, low-commitment call-to-action
• Follow up in 3-4 days if you don't hear back

Access Your Dashboard: ${process.env.BASE_URL || 'https://5ducks.com'}

---
You're receiving this because you have daily outreach enabled.
Manage preferences: ${process.env.BASE_URL || 'https://5ducks.com'}/account

© 2025 5Ducks. Making B2B prospecting delightful.
    `.trim();

    return { subject, html, text };
  }

  static generateTestEmail(): { subject: string; html: string; text: string } {
    // Generate a test email with sample data
    const testCards: EmailCard[] = [
      {
        contact: {
          id: 1,
          userId: 1,
          companyId: 1,
          name: "Sarah Johnson",
          role: "VP of Sales",
          email: "sarah.johnson@techcorp.com",
          createdAt: null,
          linkedinUrl: null,
          twitterHandle: null,
          phoneNumber: null,
          location: "San Francisco, CA",
          verificationSource: "hunter.io",
          nameConfidenceScore: 95,
          userFeedbackScore: null,
          feedbackCount: null,
          alternativeEmails: [],
          completedSearches: [],
          probability: 85,
          department: null,
          lastEnriched: null,
          lastValidated: null
        },
        company: {
          id: 1,
          userId: 1,
          listId: 1,
          name: "TechCorp Solutions",
          website: "https://techcorp.com",
          description: "Leading B2B software provider",
          age: null,
          size: 750,
          phoneNumber: null,
          revenue: "$50M-$100M",
          socialLinks: {},
          employees: 750,
          dateAdded: new Date(),
          source: "test",
          linkedInUrl: null,
          snapshot: null
        },
        subject: "Quick question about TechCorp's sales process",
        content: "Hi Sarah, I noticed TechCorp recently expanded your sales team. We help companies like yours streamline lead generation, saving 10+ hours per week. Would you be open to a brief call to see if we could help TechCorp hit your Q1 targets?",
        emailAddress: "sarah.johnson@techcorp.com",
        outreachUrl: "https://5ducks.com/outreach/sample"
      }
    ];

    // Duplicate the test card to create 5 cards
    const cards = Array(5).fill(null).map((_, i) => ({
      ...testCards[0],
      contact: {
        ...testCards[0].contact,
        id: i + 1,
        name: `Contact ${i + 1}`,
        email: `contact${i + 1}@example.com`
      }
    }));

    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    const date = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return this.generateDailyOutreachEmail(cards, "Test User", dayOfWeek, date);
  }
}