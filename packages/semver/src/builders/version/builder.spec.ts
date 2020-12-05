import * as childProcess from '@lerna/child-process';
import { MockBuilderContext } from '@nrwl/workspace/testing';
import * as standardVersion from 'standard-version';

import { getMockContext } from '../../utils/testing';
import { runBuilder } from './builder';
import { VersionBuilderSchema } from './schema';

/* For no apparent reason jest.mock does not work for this module. */
jest.spyOn(childProcess, 'exec');

jest.mock('standard-version', () => jest.fn(() => Promise.resolve()));

const options: VersionBuilderSchema = {
  dryRun: false,
  noVerify: false,
  firstRelease: false,
  push: false,
};

describe('@jscutlery/semver:version', () => {
  let context: MockBuilderContext;

  beforeEach(async () => {
    context = await getMockContext();
    context.getProjectMetadata = jest
      .fn()
      .mockResolvedValue({ root: '/root/lib' });
  });

  it('runs standard-version with project options', async () => {
    const output = await runBuilder(options, context).toPromise();

    expect(output).toEqual(expect.objectContaining({ success: true }));
    expect(standardVersion).toBeCalledWith(
      expect.objectContaining({
        silent: false,
        dryRun: false,
        noVerify: false,
        firstRelease: false,
        path: '/root/lib',
        infile: '/root/lib/CHANGELOG.md',
        bumpFiles: ['/root/lib/package.json'],
        packageFiles: ['/root/lib/package.json'],
      })
    );
  });

  it('should not push to Git by default', async () => {
    await runBuilder(options, context).toPromise();

    expect(childProcess.exec).not.toHaveBeenCalled();
  });

  it('should not to Git with right options', async () => {
    await runBuilder(
      { ...options, push: true, remote: 'origin', baseBranch: 'main' },
      context
    ).toPromise();

    expect(childProcess.exec).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining([
        'push',
        '--follow-tags',
        '--no-verify',
        '--atomic',
        'origin',
        'main',
      ])
    );
  });

  it('should fail if Git config is missing', async () => {
    const output = await runBuilder(
      { ...options, push: true, remote: undefined, baseBranch: null },
      context
    ).toPromise();

    expect(output).toEqual(expect.objectContaining({ success: false }));
  });
});