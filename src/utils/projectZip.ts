import JSZip from 'jszip';

import pyApp from '../../campus-parking-usage-analysis/app.py?raw';
import pyRequirements from '../../campus-parking-usage-analysis/requirements.txt?raw';
import pyReadme from '../../campus-parking-usage-analysis/README.md?raw';
import pyGitignore from '../../campus-parking-usage-analysis/.gitignore?raw';
import pyInit from '../../campus-parking-usage-analysis/modules/__init__.py?raw';
import pyLoader from '../../campus-parking-usage-analysis/modules/data_loader.py?raw';
import pyCleaning from '../../campus-parking-usage-analysis/modules/data_cleaning.py?raw';
import pyAnalytics from '../../campus-parking-usage-analysis/modules/analytics.py?raw';
import pyVisualizations from '../../campus-parking-usage-analysis/modules/visualizations.py?raw';
import pyTests from '../../campus-parking-usage-analysis/tests/test_analytics.py?raw';
import sampleCsv from '../../campus-parking-usage-analysis/data/sample_parking_data.csv?raw';

export const PYTHON_PROJECT_FILES: Array<{ path: string; content: string }> = [
  { path: 'campus-parking-usage-analysis/app.py', content: pyApp },
  { path: 'campus-parking-usage-analysis/requirements.txt', content: pyRequirements },
  { path: 'campus-parking-usage-analysis/README.md', content: pyReadme },
  { path: 'campus-parking-usage-analysis/.gitignore', content: pyGitignore },
  { path: 'campus-parking-usage-analysis/modules/__init__.py', content: pyInit },
  { path: 'campus-parking-usage-analysis/modules/data_loader.py', content: pyLoader },
  { path: 'campus-parking-usage-analysis/modules/data_cleaning.py', content: pyCleaning },
  { path: 'campus-parking-usage-analysis/modules/analytics.py', content: pyAnalytics },
  { path: 'campus-parking-usage-analysis/modules/visualizations.py', content: pyVisualizations },
  { path: 'campus-parking-usage-analysis/tests/test_analytics.py', content: pyTests },
  { path: 'campus-parking-usage-analysis/data/sample_parking_data.csv', content: sampleCsv },
];

export async function downloadPythonProjectZip(): Promise<void> {
  const zip = new JSZip();
  for (const file of PYTHON_PROJECT_FILES) {
    zip.file(file.path, file.content);
  }

  try {
    const resp = await fetch('/src/assets/images/project_banner_1795108374652.jpg');
    if (resp.ok) {
      const blob = await resp.blob();
      zip.file('campus-parking-usage-analysis/assets/project_banner.png', blob);
    }
  } catch {
    // Banner asset optional in zip if offline
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'campus-parking-usage-analysis.zip';
  a.click();
  URL.revokeObjectURL(url);
}
