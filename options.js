'use strict';

function _hasOwnProperty( obj, key ) {

  return Object.prototype.hasOwnProperty.call( obj, key );

}

function isNumber( val ) {

  return Number.isInteger( +( val ) );

}

class Options {

  constructor( options ) {

    this.defaults = options;
    this.options = Object.assign( {}, this.defaults );
    this.table = document.getElementById( 'options' );
    this.inputs = this.table.querySelectorAll( 'input' );
    this.checkList = [];
    this.init();

  }

  init() {

    this.update();

    const button = document.getElementById( 'save' );
    const inputs = this.inputs;
    const keypressHandler = ( e ) => {

      const isEnterKey = e.keyCode === 13;
      if ( isEnterKey ) this.save();

    };

    button.addEventListener( 'click', this.save.bind( this ), false );
    for ( let i in inputs ) {

      if ( _hasOwnProperty( inputs, i ) ) {

        inputs[ i ].addEventListener( 'keypress', keypressHandler, false );

      }

    }

  }

  update() {

    const callback = ( props ) => {

      // Update values.
      for ( let key in props ) {

        if ( _hasOwnProperty( props, key ) ) {

          document.getElementById( key ).value =
          ( props[ key ] ? props[ key ] : this.defaults[ key ] );

        }

      }

    };

    chrome.storage.local.get( this.options, callback );

  }

  save() {

    const updateOptions = ( elem ) => {

      if ( elem.value && isNumber( elem.value ) ) {

        this.options[ elem.id ] = elem.value;
        this.validationClear( elem );

        return;

      }

      this.checkList.push( elem );

    };

    this.inputs.forEach( updateOptions );

    if ( this.validationCheck() ) {

      return;

    }

    chrome.storage.local.set( this.options );
    chrome.runtime.sendMessage( this.options );

    this.notify();

  }

  validationClear( elem ) {

    if ( elem.classList.contains( 'error' ) ) {

      elem.classList.remove( 'error' );

    }

  }

  validationCheck() {

    if ( !!this.checkList.length ) {

      const marking = ( elem ) => elem.classList.add( 'error' );
      this.checkList.map( marking );
      this.checkList = [];
      return true;

    }

    return false;

  }

  notify() {

    const message = document.getElementById( 'savedMessage' );
    const filter = document.getElementById( 'filter' );
    // Show message.
    message.classList.add( 'saved' );
    filter.classList.add( 'saved' );
    // Hide message.
    clearTimeout( this.notify.timer );
    this.notify.timer = setTimeout( () => {

      message.classList.remove( 'saved' );
      filter.classList.remove( 'saved' );
      this.notify.timer = null;

    }, 1000 );

  }

}

const optionPage = new Options( defaults );
