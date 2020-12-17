
/* IMPORT */

import JS from './providers/js';

/* EMBEDDED */

const Embedded = {

  // TODO: Probably doesn't need to be asynchronous
  async initProvider () {
    if (!Embedded.provider) Embedded.provider = new JS ();
  },

  provider: undefined as JS,

};

/* EXPORT */

export default Embedded;
