import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { auth, User } from 'firebase';
import { BehaviorSubject, Observable } from 'rxjs';
import { first, map, tap } from 'rxjs/internal/operators';
import { Router } from '@angular/router';


@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  public state: BehaviorSubject<User | null> = new BehaviorSubject<User>(null);

  constructor(private afAuth: AngularFireAuth, private router: Router) {
    this.afAuth.authState.subscribe(user => {
      this.state.next(user);
    });
  }

  // TODO: consider returning something other than void
  login(): void {
    this.afAuth.auth.signInWithPopup(new auth.GoogleAuthProvider())
      .then()
      .catch(err => console.error(err));
  }

  logout(): void {
    this.afAuth.auth.signOut();
  }

  isLoggedIn(): Promise<boolean> {
    return this.state.pipe(
      first(),
      map(user => user !== null)
    ).toPromise();
  }
}
