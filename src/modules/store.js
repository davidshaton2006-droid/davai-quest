// Общий кэш состояния в памяти. Заполняется из Supabase при загрузке
// и синхронизируется обратно при каждом изменении — модули читают/пишут
// через это состояние, чтобы рендер не дёргал сеть на каждый чих.
export const state = {
  profile: null,
  projects: [],
  tasks: [],
  health: {
    sleep: [],
    movement: [],
    lastMovementAt: null
  }
};
