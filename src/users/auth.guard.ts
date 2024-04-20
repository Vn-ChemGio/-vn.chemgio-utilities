import { Observable } from 'rxjs';
import { CanActivate, ExecutionContext } from '@nestjs/common';

export class AuthenticateGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    request.user = {
      id: 'Xjaafefeefq',
      organizationId: 'oeqeq',
    };
    return true;
  }
}
