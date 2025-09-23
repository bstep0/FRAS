import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FaceScanner from '../FaceScanner';

jest.mock(
  'react-router-dom',
  () => ({
    useNavigate: () => jest.fn(),
  }),
  { virtual: true }
);

jest.mock('../../config/api', () => ({
  FACE_RECOGNITION_ENDPOINT: '/api/face-recognition',
  FINALIZE_ATTENDANCE_ENDPOINT: '/api/attendance/finalize',
  PENDING_VERIFICATION_MINUTES: 45,
}));

describe('FaceScanner', () => {
  const originalFetch = global.fetch;
  let stopTrack;

  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
    stopTrack = jest.fn();
    navigator.mediaDevices.getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }],
    });
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn(),
    }));
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/jpeg;base64,test');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    if (global.fetch) {
      global.fetch.mockReset();
    }
    navigator.mediaDevices.getUserMedia.mockReset();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  const prepareVideoElement = () => {
    const video = screen.getByTestId('face-video');
    Object.defineProperty(video, 'videoWidth', {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(video, 'videoHeight', {
      configurable: true,
      value: 480,
    });
    return video;
  };

  it('handles pending responses and finalizes attendance', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'pending', record_id: 'record-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success' }),
      });

    render(<FaceScanner selectedClass="class-1" studentId="student-1" />);
    prepareVideoElement();

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /capture face/i }));
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/face-recognition',
        expect.objectContaining({ method: 'POST' })
      )
    );

    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/verification is pending/i);
    expect(
      screen.getByRole('button', { name: /verification pending/i })
    ).toBeDisabled();
    expect(screen.getByText(/stay on eaglenet/i)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(45 * 60 * 1000);
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/attendance/finalize',
        expect.objectContaining({
          body: JSON.stringify({ recordId: 'record-1' }),
        })
      )
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/attendance finalized/i)
    );
  });

  it('surfaces finalize failures and restarts the stream', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'pending', record_id: 'record-2' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'failure', message: 'Left EagleNet' }),
      });

    render(<FaceScanner selectedClass="class-2" studentId="student-2" />);
    prepareVideoElement();

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /capture face/i }));
    });

    await act(async () => {
      jest.advanceTimersByTime(45 * 60 * 1000);
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Left EagleNet.*Please stay on EagleNet and try again/i
      )
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /capture face/i })).toBeEnabled()
    );

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
  });
});
