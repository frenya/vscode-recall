
/* IMPORT */

import JS from './providers/js';

/* EMBEDDED */

const Embedded = {

  initProvider () {
    if (!Embedded.provider) Embedded.provider = new JS ();
  },

  provider: undefined as JS,

};

/* EXPORT */

export default Embedded;
