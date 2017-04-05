'use strict';

class BadgeAnimate {

  constructor() {

    this.image = document.getElementById( 'badge' );
    this.canvas = document.getElementById( 'canvas' );
    this.context = this.canvas.getContext( '2d' );
    this.animationFrames = 36;
    this.rotation = 0;

  }

  ease( x ) {

    return ( 1 - Math.sin( Math.PI / 2 + x * Math.PI ) ) / 2;

  }

  draw() {

    const ceil = Math.ceil;
    const pi = Math.PI;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.context.save();
    this.context.clearRect( 0, 0, w, h );
    this.context.translate( ceil( w / 2 ), ceil( h / 2 ) );

    this.context.rotate( 2 * pi * this.ease( this.rotation ) );
    this.context.drawImage( this.image, -ceil( w / 2 ), -ceil( h / 2 ), w, h );
    this.context.restore();

    chrome.browserAction.setIcon( {
      imageData: this.context.getImageData( 0, 0, w, h )
    } );

  }

  badgeRotate() {

    this.rotation += 1 / this.animationFrames;
    this.draw();

    if ( this.rotation <= 1 ) {

      setTimeout( this.badgeRotate.bind( this ), 10 );

    } else {

      this.rotation = 0;
      this.updateBadge();

    }

  }

}

class MailChecker extends BadgeAnimate {

  static init( defaults ) {

    const handler = ( options ) => new MailChecker( defaults, options );
    return chrome.storage.local.get( defaults, handler );

  }

  static badgeData() {

    return {
      path: [ 'icon_inbox_not_logged_in_01.png', 'icon_inbox_logged_in_01.png' ],
      text: [ '', '' ]
    };

  }

  constructor( defaults, options ) {

    super();

    this.core = this.constructor;
    this.defaults = Object.assign( {}, defaults );
    this.options = Object.assign( {}, options );
    this.badgeData = Object.assign( {}, this.core.badgeData() );
    this.init();

  }

  init() {

    this.xhr = new XMLHttpRequest();

    this.onReceive();
    this.onPolling();
    this.onBadgeClicked();

  }

  onReceive() {

    const handler = ( data ) => {

      this.badgeData.text[ 1 ] = data.text[ 1 ];

    };

    chrome.storage.local.get( this.badgeData, handler );

    this.optionsChanged();

  }

  optionsChanged() {

    const handler = ( data ) => {

      this.options = Object.assign( {}, data );

      chrome.alarms.clear( 'polling' );
      chrome.alarms.create( 'polling', {periodInMinutes: this.getPollIntervalTime()} );
      this.polling( true );

    };

    chrome.runtime.onMessage.addListener( handler );

  }

  onPolling() {

    chrome.alarms.create( 'polling', {periodInMinutes: this.getPollIntervalTime()} );
    chrome.alarms.onAlarm.addListener( this.polling.bind( this ) );
    this.polling( true );

  }

  onBadgeClicked() {

    const handler = () => this.createTab().polling( true );
    chrome.browserAction.onClicked.addListener( handler );

  }

  updateBadge( isSuccess ) {

    const i = +isSuccess;
    if ( isSuccess ) {

      chrome.browserAction.setBadgeBackgroundColor( {color: [ 42, 80, 154, 1 ]} );

    }

    if ( typeof this.badgeData.text[ i ] !== 'undefined' ) {

      chrome.browserAction.setIcon( {path: this.badgeData.path[ i ]} );
      chrome.browserAction.setBadgeText( {text: this.badgeData.text[ i ]} );

    }

  }

  createTab() {

    const callback = ( tabs ) => {

      for ( let i = 0, tab; tab = tabs[ i ]; i++ ) {

        if ( tab.url && this.isMailUrl( tab.url ) ) {

          // Update a tab.
          chrome.tabs.update( tab.id, {selected: true} );
          return;

        }

      }

      chrome.tabs.create( {url: this.getMailBoxUrl()} );

    };

    chrome.tabs.getAllInWindow( null, callback );

    return this;

  }

  polling( isAbort ) {

    try {

      if ( isAbort ) {

        this.xhr.abort();

      }

      this.xhr.open( 'GET', this.getMailFeedUrl(), true );
      this.xhr.onload = () => {

        const isDone = this.xhr.readyState === 4;
        const isSuccess = this.xhr.status === 200;
        let isUpdate = false;

        if ( this.isNoAccount( this.xhr.responseURL ) ) {

          this.options.accountNumber = this.defaults.accountNumber;
          chrome.storage.local.set( this.options );

        }

        if ( isDone && isSuccess ) {

          const entries = this.xhr.responseXML.getElementsByTagName( 'entry' );
          const entriesCount = String( entries.length === 0 ? '' : entries.length );
          // Update of badge count.
          isUpdate = this.badgeData.text[ 1 ] !== entriesCount;

          this.badgeData.text[ 1 ] = entriesCount;
          chrome.storage.local.set( this.badgeData );

        }

        if ( isUpdate ) this.badgeRotate();
        this.updateBadge( isSuccess );

      };

      this.xhr.onerror = () => this.updateBadge( 0 );
      this.xhr.send( null );

    } catch ( error ) {

      this.updateBadge( 0 );

    }

  }

  getMailBoxUrl() {

    const number = this.options.accountNumber;
    return `https://inbox.google.com/u/${number}/`;

  }

  getMailFeedUrl() {

    const number = this.options.accountNumber;
    return `https://mail.google.com/mail/u/${number}/feed/atom`;

  }

  getPollIntervalTime() {

    return ( ( sec ) => {

      return sec / 60;

    } )( this.options.pollingInterval );

  }

  isMailUrl( url ) {

    return ( url.replace( /^(.+)#.+/, '$1' ) ) === this.getMailBoxUrl();

  }

  isNoAccount( result ) {

    return result !== this.getMailFeedUrl();

  }

}

const mailChecker = MailChecker.init( defaults );

