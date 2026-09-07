import React, { useEffect, useState, useRef } from 'react';
import {
  FolderTree,
  X,
  Upload,
  FolderPlus,
  RefreshCw,
  Folder,
  FileText,
  Download,
  Trash2,
  Edit,
  ArrowUp
} from 'lucide-react';
import { ServerProfile, SftpFileItem } from '../../types';
import { api, authStorage } from '../../api/client';

interface FileManagerModalProps {
  server: ServerProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FileManagerModal: React.FC<FileManagerModalProps> = ({
  server,
  isOpen,
  onClose
}) => {
  const [currentPath, setCurrentPath] = useState('.');
  const [files, setFiles] = useState<SftpFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showMkdir, setShowMkdir] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [renameTarget, setRenameTarget] = useState<SftpFileItem | null>(null);
  const [newFilename, setNewFilename] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDirectory = async (path: string) => {
    if (!server) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.sftp.listFiles(server.id, path);
      setCurrentPath(res.currentPath);
      setFiles(res.files);
    } catch (err: any) {
      setError(err.message || 'Failed to list directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && server) {
      loadDirectory('.');
    }
  }, [isOpen, server]);

  if (!isOpen || !server) return null;

  const handleNavigateUp = () => {
    if (currentPath === '/' || currentPath === '.') return;
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    const parentPath = segments.length === 0 ? '/' : '/' + segments.join('/');
    loadDirectory(parentPath);
  };

  const handleFolderClick = (item: SftpFileItem) => {
    if (item.directory) {
      loadDirectory(item.path);
    }
  };

  const handleDownload = (item: SftpFileItem) => {
    const token = authStorage.getToken();
    const downloadUrl = api.sftp.downloadUrl(server.id, item.path);
    
    // Create an authenticated download link using fetch blob
    fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => setError(err.message));
  };

  const handleDelete = async (item: SftpFileItem) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
    try {
      await api.sftp.delete(server.id, item.path);
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleMkdir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const targetPath = currentPath.endsWith('/')
        ? currentPath + newFolderName.trim()
        : currentPath + '/' + newFolderName.trim();
      await api.sftp.mkdir(server.id, targetPath);
      setNewFolderName('');
      setShowMkdir(false);
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newFilename.trim()) return;
    try {
      const dirPath = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/'));
      const targetNewPath = dirPath ? `${dirPath}/${newFilename.trim()}` : newFilename.trim();
      await api.sftp.rename(server.id, renameTarget.path, targetNewPath);
      setRenameTarget(null);
      setNewFilename('');
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || 'Failed to rename');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await api.sftp.upload(server.id, currentPath, file);
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (ms: number) => {
    if (!ms) return '-';
    return new Date(ms).toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FolderTree size={20} color="var(--accent-cyan)" />
            <span>SFTP File Browser: {server.name}</span>
          </h2>
          <button className="btn btn-outline btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.4)', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            className="btn btn-outline btn-sm"
            title="Go up one directory"
            onClick={handleNavigateUp}
          >
            <ArrowUp size={14} />
          </button>

          <div className="sftp-breadcrumb" style={{ flex: 1 }}>
            {currentPath.split('/').map((seg, idx, arr) => (
              <React.Fragment key={idx}>
                <span
                  className="breadcrumb-segment"
                  onClick={() => {
                    const target = arr.slice(0, idx + 1).join('/') || '/';
                    loadDirectory(target);
                  }}
                >
                  {seg || '/'}
                </span>
                {idx < arr.length - 1 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
              </React.Fragment>
            ))}
          </div>

          <button
            className="btn btn-outline btn-sm"
            title="Refresh"
            onClick={() => loadDirectory(currentPath)}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowMkdir(true)}
          >
            <FolderPlus size={14} />
            <span>New Folder</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            <span>Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {showMkdir && (
          <form onSubmit={handleMkdir} style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', background: '#1e293b' }}>
            <input
              type="text"
              className="form-control"
              placeholder="New folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-primary btn-sm">Create</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowMkdir(false)}>Cancel</button>
          </form>
        )}

        {renameTarget && (
          <form onSubmit={handleRename} style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', background: '#1e293b' }}>
            <input
              type="text"
              className="form-control"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-primary btn-sm">Rename</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setRenameTarget(null)}>Cancel</button>
          </form>
        )}

        <div className="modal-body" style={{ padding: 0 }}>
          <table className="sftp-file-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Permissions</th>
                <th>Modified</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((item) => (
                <tr
                  key={item.path}
                  className="sftp-row"
                  onDoubleClick={() => handleFolderClick(item)}
                >
                  <td>
                    <div className="file-name-cell">
                      {item.directory ? (
                        <Folder size={16} color="var(--accent-amber)" />
                      ) : (
                        <FileText size={16} color="var(--text-secondary)" />
                      )}
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td>{item.directory ? '-' : formatSize(item.size)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{item.permissions}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(item.modifiedTime)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                      {!item.directory && (
                        <button
                          className="btn btn-outline btn-icon"
                          style={{ padding: '4px', border: 'none' }}
                          title="Download"
                          onClick={() => handleDownload(item)}
                        >
                          <Download size={14} color="var(--accent-cyan)" />
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-icon"
                        style={{ padding: '4px', border: 'none' }}
                        title="Rename"
                        onClick={() => {
                          setRenameTarget(item);
                          setNewFilename(item.name);
                        }}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn btn-outline btn-icon"
                        style={{ padding: '4px', border: 'none' }}
                        title="Delete"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 size={14} color="var(--accent-rose)" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {files.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Empty folder
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {files.length} items total
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
