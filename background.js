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

// defaults.js
// const defaults = {...};
let options = null;
const badgeAnimate = new BadgeAnimate();
const badgeData = {
  path: [ 'icon_inbox_not_logged_in_01.png', 'icon_inbox_logged_in_01.png' ],
  text: [ '', '' ]
};
const xhr = new XMLHttpRequest();

chrome.storage.local.get( defaults, ( opt ) => options = opt );
chrome.runtime.onInstalled.addListener( onInit );
addListenerPolling();
addListenerReceive();
addListenerBadgeClicked();

function onInit() {

  polling();
  chrome.alarms.create( 'polling', {periodInMinutes: getPollIntervalTime()} );

}

function addListenerPolling() {

  chrome.alarms.onAlarm.addListener( polling.bind( this ) );

}

function addListenerReceive() {

  const handler = ( data ) => {

    badgeData.text[ 1 ] = data.text[ 1 ];

  };

  chrome.storage.local.get( badgeData, handler );

  optionsChanged();

}

function addListenerBadgeClicked() {

  chrome.browserAction.onClicked.addListener( () => {

    createTab();
    polling( true );

  } );

}

function optionsChanged() {

  const handler = ( data ) => {

    options = Object.assign( {}, data );

    chrome.alarms.clear( 'polling' );
    chrome.alarms.create( 'polling', {periodInMinutes: getPollIntervalTime()} );
    polling( true );

  };

  chrome.runtime.onMessage.addListener( handler );

}

function updateBadge( isSuccess ) {

  const i = +isSuccess;
  if ( isSuccess ) {

    chrome.browserAction.setBadgeBackgroundColor( {color: [ 42, 80, 154, 1 ]} );

  }

  if ( typeof badgeData.text[ i ] !== 'undefined' ) {

    chrome.browserAction.setIcon( {path: badgeData.path[ i ]} );
    chrome.browserAction.setBadgeText( {text: badgeData.text[ i ]} );

  }

}

function createTab() {

  const callback = ( tabs ) => {

    for ( let i = 0, tab; tab = tabs[ i ]; i++ ) {

      if ( tab.url && isMailUrl( tab.url ) ) {

        // Update a tab.
        chrome.tabs.update( tab.id, {selected: true} );
        return;

      }

    }

    chrome.tabs.create( {url: getMailBoxUrl()} );

  };

  chrome.tabs.getAllInWindow( null, callback );

}

function polling( isAbort ) {

  try {

    if ( isAbort ) {

      xhr.abort();

    }

    xhr.open( 'GET', getMailFeedUrl(), true );
    xhr.onload = () => {

      const isDone = xhr.readyState === 4;
      const isSuccess = xhr.status === 200;
      let isUpdate = false;

      if ( isNoAccount( xhr.responseURL ) ) {

        options.accountNumber = defaults.accountNumber;
        chrome.storage.local.set( options );

      }

      if ( isDone && isSuccess ) {

        const entries = xhr.responseXML.getElementsByTagName( 'entry' );
        const entriesCount = String( entries.length === 0 ? '' : entries.length );
        // Update of badge count.
        isUpdate = badgeData.text[ 1 ] !== entriesCount;

        badgeData.text[ 1 ] = entriesCount;
        chrome.storage.local.set( badgeData );

      }

      if ( isUpdate ) badgeAnimate.badgeRotate();
      updateBadge( isSuccess );

    };

    xhr.onerror = () => updateBadge( 0 );
    xhr.send( null );

  } catch ( error ) {

    updateBadge( 0 );

  }

}

function getMailBoxUrl() {

  const number = options.accountNumber;
  return `https://inbox.google.com/u/${number}/`;

}

function getMailFeedUrl() {

  const number = options.accountNumber;
  return `https://mail.google.com/mail/u/${number}/feed/atom`;

}

function getPollIntervalTime() {

  return ( ( sec ) => {

    return sec / 60;

  } )( options.pollingInterval );

}

function isMailUrl( url ) {

  return ( url.replace( /^(.+)#.+/, '$1' ) ) === getMailBoxUrl();

}

function isNoAccount( result ) {

  return result !== getMailFeedUrl();

}
