
/* IMPORT */

import * as moment from 'moment';
import Utils from '../../utils';
import Consts from '../../consts';

import Item from './item';

const displayFormat = {
  sameDay: '[Today]', 
  nextDay: '[Tomorrow]', 
  nextWeek: 'dddd', 
  sameElse: 'dddd, MMM DD'
};

/* TODO */

class Todo extends Item {

  contextValue = 'todo';

  constructor ( obj, label, icon = false ) {

    super ( obj, label );

    this.tooltip = obj.message;

    this.command = {
      title: 'Reveal',
      command: 'recall.viewRevealTodo',
      arguments: [this]
    };

    // Color by due date
    this.setTaskIcon(Todo.getDateColor(obj.dueDate));

    // Indicate external service link
    if (obj.externalURL) this.contextValue = 'todo-linked';

  }

  setTaskIcon (color) {
    this.iconPath = Utils.view.getTaskIcon(color) || this.iconPath;
  }

  static getDateColor (dateStr) {
    if (dateStr) {
      const dueDate = moment(dateStr);
      const today = moment();
      if (dueDate.isSame(today, 'day')) {
        return Consts.dateColors.dueSoon;
      }
      else if (dueDate.isBefore(today, 'day')) {
        return Consts.dateColors.overdue;
      }
      else if (dueDate.isAfter(today, 'day')) {
        return Consts.dateColors.future;
      }
    }
    else return Consts.dateColors.undated;
  }

}

/* EXPORT */

export default Todo;
