import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile } from 'obsidian';

interface MyPluginSettings {
    taskNotePath: string;
    newNotePath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    taskNotePath: '',
    newNotePath: ''
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    isUpdating: boolean = false;

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new MyPluginSettingsTab(this.app, this));

        this.addCommand({
            id: 'update-tasks',
            name: 'Update Tasks',
            callback: () => this.updateTasks()
        });

        this.registerEvent(this.app.vault.on('modify', (file: TAbstractFile) => {
            if (file.path === this.settings.taskNotePath && !this.isUpdating) {
                this.isUpdating = true;
                this.updateTasks().finally(() => {
                    this.isUpdating = false;
                });
            }
        }));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async updateTasks() {
		const taskNotePath = this.settings.taskNotePath;
		const newNotePath = this.settings.newNotePath;
	
		const taskNoteFile = this.app.vault.getAbstractFileByPath(taskNotePath);
		const newNoteFile = this.app.vault.getAbstractFileByPath(newNotePath);
	
		if (!(taskNoteFile instanceof TFile) || !(newNoteFile instanceof TFile)) {
			console.error('Invalid file paths');
			return;
		}
	
		const taskNote = await this.app.vault.read(taskNoteFile);
		const newNote = await this.app.vault.read(newNoteFile);
	
		const taskLines = taskNote.split('\n');
		const newNoteLines = newNote.split('\n');
	
		let updatedTaskNote = '';
		let taskBuffer = '';
		let inTask = false;
		let allStepsChecked = true;
		let inButtonBlock = false;
		var i = 0;
		for (let line of taskLines) {
			if (line.startsWith('```button')) {
				inButtonBlock = true;
			}

			if (inButtonBlock) {
				updatedTaskNote += line + '\n';
				if (line === '```') {
					inButtonBlock = false;
				}
				continue;
			}
			
			if (line.match(/^- \[ \] \*\*/)) {
				if (inTask) {
					if (allStepsChecked) {
						newNoteLines.push(taskBuffer.replace(/\[ \]/g, '[x]'));
					} else {
						updatedTaskNote += taskBuffer;
					}
					taskBuffer = '';
				}
				inTask = true;
				allStepsChecked = true;
				taskBuffer = line + '\n';
			} else if (line.match(/^- \[x\] \*\*/)) {
				if (inTask) {
					if (allStepsChecked) {
						newNoteLines.push(taskBuffer.replace(/\[ \]/g, '[x]'));
					} else {
						updatedTaskNote += taskBuffer;
					}
					taskBuffer = '';
				}
				inTask = true;
				allStepsChecked = true;
				taskBuffer = line + '\n';
			} else if (line.match(/^    - \[x\]/)) {
				taskBuffer += line + '\n';
			} else if (line.match(/^    - \[ \]/)) {
				allStepsChecked = false;
				taskBuffer += line + '\n';
			} else {
				if (inTask) {
					taskBuffer += line + '\n';
				} else {
					updatedTaskNote += line + '\n';
				}
			}
		}
	
		if (inTask) {
			if (allStepsChecked) {
				newNoteLines.push(taskBuffer.replace(/\[ \]/g, '[x]'));
			} else {
				updatedTaskNote += taskBuffer;
			}
		}
	
		await this.app.vault.modify(taskNoteFile, updatedTaskNote.trim());
		await this.app.vault.modify(newNoteFile, newNoteLines.join('\n').trim());
	}
}

class MyPluginSettingsTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Settings for my awesome plugin.' });

        const files = this.app.vault.getFiles();

        new Setting(containerEl)
            .setName('Task Note Path')
            .setDesc('Path to the note containing tasks')
            .addDropdown(dropdown => {
                files.forEach(file => {
                    dropdown.addOption(file.path, file.path);
                });
                dropdown.setValue(this.plugin.settings.taskNotePath);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.taskNotePath = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('New Note Path')
            .setDesc('Path to the new note')
            .addDropdown(dropdown => {
                files.forEach(file => {
                    dropdown.addOption(file.path, file.path);
                });
                dropdown.setValue(this.plugin.settings.newNotePath);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.newNotePath = value;
                    await this.plugin.saveSettings();
                });
            });
    }
}