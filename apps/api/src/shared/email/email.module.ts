import { Global, Module } from '@nestjs/common';

import { EMAIL_SENDER, type EmailSender } from './email-sender.port.js';
import { StubEmailSender } from './stub-email-sender.js';

@Global()
@Module({
  providers: [{ provide: EMAIL_SENDER, useFactory: (): EmailSender => new StubEmailSender() }],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
