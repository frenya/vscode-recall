const Styles = {
  // Style used for the empty link in synchronized tasks
  syncLink: {
    light: {
      color: '#bbb'
    },
    dark: {
      color:  '#444'
    }
  },

  // Style used for an unknown mention
  missingMention: {
    light: {
      color: '#d03535'
    },
    dark: {
      color:  '#d03535',
    }
  },

  // Style used for mentions
  mention: {
    light: {
      color: '#112f77'
    },
    dark: {
      color:  '#21cadd',
    }
  }
};

type IStyles = typeof  Styles;

export default Styles as IStyles;
