import { BuilderContext } from '@angular-devkit/architect';
import { exception } from 'console';
import { Observable } from 'rxjs';

import { PluginAdapter } from './plugin-adapter';
import { createFakeContext } from './testing';
import { CommonVersionOptions } from './version';

jest.mock('./utils/filesystem');

describe('PluginAdapter', () => {
  const options: CommonVersionOptions = {
    dryRun: false,
    noVerify: false,
    newVersion: '0.0.1',
    preset: 'angular',
    projectRoot: '/root/packages/lib',
    tagPrefix: 'v',
  };

  let context: BuilderContext;

  const semanticPluginSpy = {
    publish: jest.fn(),
    addChannel: jest.fn(),
    verifyCondition: jest.fn(),
  };

  beforeEach(() => {
    context = createFakeContext({
      project: 'lib',
      projectRoot: '/root/packages/lib',
      workspaceRoot: '/root',
    });

    (context.getTargetOptions as jest.Mock).mockResolvedValue({
      outputPath: 'dist/packages/lib',
    });

    semanticPluginSpy.publish.mockResolvedValue(undefined);
    semanticPluginSpy.addChannel.mockResolvedValue(undefined);
    semanticPluginSpy.verifyCondition.mockResolvedValue(undefined);
  });

  it(`should call semantic-release 'addChannel' and 'publish' hooks`, async () => {
    const plugin = PluginAdapter.adapt({
      name: '@semantic-release/spy-plugin',
      plugin: semanticPluginSpy,
    });

    await (plugin.publish(
      {},
      options,
      context
    ) as Observable<unknown>).toPromise();

    expect(semanticPluginSpy.addChannel).toBeCalled();
    expect(semanticPluginSpy.publish).toBeCalled();
    expect(semanticPluginSpy.addChannel).toHaveBeenCalledBefore(
      semanticPluginSpy.publish
    );
  });

  it(`should call semantic-release 'publish' hook with right options`, async () => {
    const plugin = PluginAdapter.adapt({
      name: '@semantic-release/spy-plugin',
      plugin: semanticPluginSpy,
    });

    await (plugin.publish(
      {},
      options,
      context
    ) as Observable<unknown>).toPromise();

    expect(semanticPluginSpy.publish).toBeCalledWith(
      expect.objectContaining({
        npmPublish: true,
        pkgRoot: '/root/dist/packages/lib',
      }),
      expect.objectContaining({
        cwd: '/root/packages/lib',
        env: expect.any(Object),
        stderr: expect.anything(),
        stdout: expect.anything(),
        logger: expect.objectContaining({
          log: expect.any(Function),
        }),
        nextRelease: expect.objectContaining({
          version: '0.0.1', // @todo test dist tag / channel
        }),
      })
    );
  });

  it(`should call semantic-release 'addChannel' hook with right options`, async () => {
    const plugin = PluginAdapter.adapt({
      name: '@semantic-release/spy-plugin',
      plugin: semanticPluginSpy,
    });

    await (plugin.publish(
      {},
      options,
      context
    ) as Observable<unknown>).toPromise();

    expect(semanticPluginSpy.addChannel).toBeCalledWith(
      expect.objectContaining({
        pkgRoot: '/root/dist/packages/lib',
        npmPublish: true,
      }),
      expect.objectContaining({
        cwd: '/root/packages/lib',
        env: expect.any(Object),
        stderr: expect.anything(),
        stdout: expect.anything(),
        logger: expect.objectContaining({
          log: expect.any(Function),
        }),
        nextRelease: expect.objectContaining({
          version: '0.0.1', // @todo test dist tag / channel
        }),
      })
    );
  });

  it(`should fail for unsupported plugin`, async () => {
    expect(() =>
      PluginAdapter.adapt({
        name: '@semantic-release/spy-plugin',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        plugin: { publish() {} },
      })
    ).toThrow('Plugin not supported');
  });
});
