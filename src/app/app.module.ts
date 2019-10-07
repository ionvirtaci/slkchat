import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AngularFireModule } from '@angular/fire';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { FlexLayoutModule } from '@angular/flex-layout';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AMaterialModule } from './a-material.module';
import { AppStoreModule } from './app-store.module';
import { AuthenticationPageComponent } from './pages/authentication/authentication.page';
import { ConversationsPageComponent } from './pages/conversations/conversations.page';
import { ContactListComponent } from './reusables/contact-list/contact-list.component';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [
    AppComponent,
    AuthenticationPageComponent,
    ConversationsPageComponent,
    ContactListComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AMaterialModule,
    AppStoreModule,
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,
    FlexLayoutModule
  ],
  entryComponents: [
    ContactListComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
