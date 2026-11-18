import { useEffect, useState, type FormEvent } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import { remove, uploadData } from 'aws-amplify/storage';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';
import './App.css';

const client = generateClient<Schema>();
type Photo = Schema['Photo']['type'];
type PhotoCreateInput = Pick<Photo, 'title' | 'description' | 's3Key'>;

function createPhoto(input: PhotoCreateInput) {
  // The installed Amplify client type adds a conflicting string[] index signature.
  // @ts-expect-error Amplify's generated index signature conflicts with scalar model fields.
  return client.models.Photo.create(input);
}

const apiEndpoint = (
  outputs as {
    custom?: { API?: { PhotoRestApi?: { endpoint?: string } } };
  }
).custom?.API?.PhotoRestApi?.endpoint;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function App() {
  return (
    <Authenticator socialProviders={['google']}>
      {({ signOut, user }) => (
        <Gallery userId={user.userId} signOut={signOut} />
      )}
    </Authenticator>
  );
}

function Gallery({
  userId,
  signOut,
}: {
  userId: string;
  signOut?: () => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [apiMessage, setApiMessage] = useState('');

  useEffect(() => {
    let active = true;
    const subscription = client.models.Photo.observeQuery().subscribe({
      next: ({ items }) => {
        if (active) {
          setPhotos([...items]);
          setLoading(false);
        }
      },
      error: (cause: unknown) => {
        if (active) {
          setError(`Could not load photos: ${getErrorMessage(cause)}`);
          setLoading(false);
        }
      },
    });

    void fetchAuthSession()
      .then((session) => {
        if (active) {
          const groups = session.tokens?.idToken?.payload['cognito:groups'];
          setIsAdmin(Array.isArray(groups) && groups.includes('Admins'));
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            `Could not read account permissions: ${getErrorMessage(cause)}`,
          );
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) {
      setError('Choose an image to upload.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { path } = await uploadData({
        path: ({ identityId }) =>
          `photos/${identityId}/${Date.now()}-${file.name}`,
        data: file,
        options: { contentType: file.type },
      }).result;
      const { data: photo, errors } = await createPhoto({
        title: title.trim(),
        description: description.trim() || undefined,
        s3Key: path,
      });
      if (errors?.length || !photo) {
        const message =
          errors?.map((item) => item.message).join(', ') ||
          'The photo record was not created.';
        try {
          await remove({ path });
        } catch (cause: unknown) {
          throw new Error(
            `${message} The uploaded image could not be removed: ${getErrorMessage(cause)}`,
            { cause },
          );
        }
        throw new Error(message);
      }

      setTitle('');
      setDescription('');
      setFile(null);
      form.reset();
    } catch (cause: unknown) {
      setError(`Upload failed: ${getErrorMessage(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(photo: Photo) {
    setBusy(true);
    setError('');
    try {
      const { data: deleted, errors } = await client.models.Photo.delete({
        id: photo.id,
      });
      if (errors?.length || !deleted) {
        throw new Error(
          errors?.map((item) => item.message).join(', ') ||
            'The photo record was not deleted.',
        );
      }
      await remove({ path: photo.s3Key });
    } catch (cause: unknown) {
      setError(`Delete failed: ${getErrorMessage(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function callMeEndpoint() {
    setApiMessage('');
    try {
      if (!apiEndpoint) {
        throw new Error(
          'REST API endpoint is missing from amplify_outputs.json.',
        );
      }
      const token = (await fetchAuthSession()).tokens?.idToken?.toString();
      if (!token) {
        throw new Error('No signed-in ID token is available.');
      }
      const response = await fetch(`${apiEndpoint}me`, {
        headers: { Authorization: token },
      });
      const body: unknown = await response.json();
      setApiMessage(`REST API (${response.status}): ${JSON.stringify(body)}`);
    } catch (cause: unknown) {
      setApiMessage(`REST API request failed: ${getErrorMessage(cause)}`);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">YOUR COMMUNITY GALLERY</p>
          <h1>Photo Gallery</h1>
        </div>
        <button className="button button-secondary" onClick={signOut}>
          Sign out
        </button>
      </header>

      <section className="welcome">
        <div>
          <h2>Share a moment</h2>
          <p>Upload an image for everyone in your gallery to see.</p>
        </div>
        <button className="button button-secondary" onClick={callMeEndpoint}>
          Check protected API
        </button>
      </section>

      {apiMessage && <p className="notice">{apiMessage}</p>}
      {error && <p className="notice notice-error">{error}</p>}

      <form className="upload-form" onSubmit={handleUpload}>
        <label>
          Photo title
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="A day at the beach"
          />
        </label>
        <label>
          Description
          <input
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add a few details (optional)"
          />
        </label>
        <label className="file-field">
          Image
          <input
            required
            accept="image/*"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button className="button button-primary" disabled={busy}>
          {busy ? 'Working…' : 'Upload photo'}
        </button>
      </form>

      <section className="gallery-section">
        <div className="section-heading">
          <h2>Recent photos</h2>
          <span>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>
        {loading ? (
          <p className="empty-state">Loading your gallery…</p>
        ) : photos.length === 0 ? (
          <p className="empty-state">No photos yet. Add the first one above.</p>
        ) : (
          <div className="photo-grid">
            {photos.map((photo) => {
              const isOwner =
                photo.owner?.split('::')[0] === userId ||
                photo.owner === userId;
              return (
                <article className="photo-card" key={photo.id}>
                  <StorageImage
                    alt={photo.title}
                    path={photo.s3Key}
                    className="photo-image"
                  />
                  <div className="photo-details">
                    <div>
                      <h3>{photo.title}</h3>
                      {photo.description && <p>{photo.description}</p>}
                    </div>
                    {(isAdmin || isOwner) && (
                      <button
                        className="button button-danger"
                        disabled={busy}
                        onClick={() => void handleDelete(photo)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
