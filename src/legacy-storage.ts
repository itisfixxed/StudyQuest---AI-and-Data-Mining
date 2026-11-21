// The previous module code is used only to open existing browser data and progress backups.
export const previousModuleCode = atob('SUU0NDgz');

export function sourceLabel(file: string) {
  return file.replace(previousModuleCode + '-EE6483 ', '')
    .replace(previousModuleCode + ' - ', '')
    .replace(previousModuleCode + '_', '')
    .replace(previousModuleCode + ' ', '');
}
