import * as gitRawCommits from 'git-raw-commits';
import { PassThrough } from 'stream';
import { of, throwError } from 'rxjs';
import { getCommits, tryPushToGitRemote } from './git';
import * as cp from './exec-async';

jest.mock('git-raw-commits', () => jest.fn());
jest.mock('./exec-async');

describe('git.getCommits', () => {
  const mockGitRawCommits = gitRawCommits as jest.Mock;

  afterEach(() => (cp.execAsync as jest.Mock).mockRestore());

  it('should get commits list', () => {
    const stream = new PassThrough();
    mockGitRawCommits.mockReturnValue(stream);

    const observer = {
      next: jest.fn(),
      complete: jest.fn(),
    };

    getCommits({
      projectRoot: 'libs/demo',
      since: 'x1.0.0',
    }).subscribe(observer);

    stream.emit('data', 'feat A');
    stream.emit('data', 'feat B');
    stream.emit('close');

    expect(observer.next).toBeCalledTimes(1);
    expect(observer.next).toBeCalledWith(['feat A', 'feat B']);
    expect(observer.complete).toBeCalledTimes(1);
  });

  describe('git.tryPushToGitRemote', () => {
    it('should Git push with right options', async () => {
      jest
        .spyOn(cp, 'execAsync')
        .mockReturnValue(of({ stderr: '', stdout: 'success' }));

      await tryPushToGitRemote({
        remote: 'upstream',
        branch: 'master',
        noVerify: false,
      }).toPromise();

      expect(cp.execAsync).toBeCalledWith(
        'git',
        expect.arrayContaining([
          'push',
          '--follow-tags',
          '--atomic',
          'upstream',
          'master',
        ])
      );
    });

    it(`should Git push and add '--no-verify' option when asked for`, async () => {
      jest
        .spyOn(cp, 'execAsync')
        .mockReturnValue(of({ stderr: '', stdout: 'success' }));

      await tryPushToGitRemote({
        remote: 'origin',
        branch: 'main',
        noVerify: true,
      }).toPromise();

      expect(cp.execAsync).toBeCalledWith(
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

    it(`should retry Git push if '--atomic' option not supported`, async () => {
      jest
        .spyOn(cp, 'execAsync')
        .mockReturnValueOnce(
          throwError({ stderr: 'atomic failed', stdout: '' })
        )
        .mockReturnValueOnce(of({ stderr: '', stdout: 'success' }));

      jest.spyOn(console, 'warn').mockImplementation();

      await tryPushToGitRemote({
        remote: 'origin',
        branch: 'master',
        noVerify: false,
      }).toPromise();

      expect(cp.execAsync).toHaveBeenNthCalledWith(
        1,
        'git',
        expect.arrayContaining(['push', '--atomic', '--follow-tags'])
      );
      expect(cp.execAsync).toHaveBeenNthCalledWith(
        2,
        'git',
        expect.not.arrayContaining(['--atomic'])
      );
      expect(console.warn).toBeCalled();
    });

    it(`should throw if Git push failed`, async () => {
      jest
        .spyOn(cp, 'execAsync')
        .mockReturnValue(
          throwError({ stderr: 'failed', stdout: '' })
        );

      try {
        await tryPushToGitRemote({
          remote: 'origin',
          branch: 'master',
          noVerify: false,
        }).toPromise();
        fail();
      } catch (error) {
        expect(cp.execAsync).toBeCalledTimes(1);
        expect(error).toEqual(
          expect.objectContaining({ stderr: 'failed', stdout: '' })
        );
      }
    });

    it('should fail if options are undefined', async () => {
      try {
        await tryPushToGitRemote({
          remote: undefined as any,
          branch: undefined as any,
          noVerify: false,
        }).toPromise();
        fail();
      } catch (error) {
        expect(error.message).toContain('Missing Git options');
      }
    });
  })
});
