// Simple template manager for client-side (localStorage based)
export const templateManager = {
  getTemplates: () => {
    try {
      const stored = localStorage.getItem('automation-templates');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  },

  getAllTemplates: () => {
    return templateManager.getTemplates();
  },

  getDefaultTemplates: (): Record<string, any> => {
    // Return empty object - default templates can be added here
    return {};
  },

  saveTemplate: (name: string, template: any) => {
    try {
      const templates = templateManager.getTemplates();
      templates[name] = template;
      localStorage.setItem('automation-templates', JSON.stringify(templates));
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  },

  addCustomTemplate: (name: string, template: any) => {
    templateManager.saveTemplate(name, template);
  },

  deleteTemplate: (name: string) => {
    try {
      const templates = templateManager.getTemplates();
      delete templates[name];
      localStorage.setItem('automation-templates', JSON.stringify(templates));
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  },

  deleteCustomTemplate: (name: string) => {
    templateManager.deleteTemplate(name);
  },

  renameTemplate: (oldName: string, newName: string) => {
    try {
      const templates = templateManager.getTemplates();
      if (templates[oldName]) {
        templates[newName] = templates[oldName];
        delete templates[oldName];
        localStorage.setItem('automation-templates', JSON.stringify(templates));
      }
    } catch (error) {
      console.error('Failed to rename template:', error);
    }
  },

  hasTemplate: (name: string) => {
    const templates = templateManager.getTemplates();
    return name in templates;
  }
};
