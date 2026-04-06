import { renderTemplate } from './mail.helper';
import { MailTemplate } from './mail.types';

describe('renderTemplate', () => {
  it('renders notification.tr.html with payload replacements', () => {
    const prevSmtpFrom = process.env.SMTP_FROM;
    process.env.SMTP_FROM = 'noreply@test.local';

    try {
      const html = renderTemplate(
        MailTemplate.NOTIFICATION,
        {
          username: 'Test User',
          title: 'Toplantı Hatırlatması',
          message: '5 dakika kaldı.',
        },
        'tr',
      );

      expect(html).toContain('Test User');
      expect(html).toContain('Toplantı Hatırlatması');
      expect(html).toContain('5 dakika kaldı.');
      expect(html).toContain('noreply@test.local');
      expect(html).not.toContain('{{username}}');
      expect(html).not.toContain('{{title}}');
      expect(html).not.toContain('{{message}}');
    } finally {
      process.env.SMTP_FROM = prevSmtpFrom;
    }
  });
});
