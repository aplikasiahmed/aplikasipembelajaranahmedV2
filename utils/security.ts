import Swal from 'sweetalert2';

/**
 * Custom SweetAlert2 modal to verify the security token.
 * Adds a fully functional "eye" toggle button to show/hide the password.
 * 
 * @param customText Custom description/sub-text shown inside the modal.
 * @param customTitle Custom title of the modal. Defaults to 'Verifikasi Keamanan'.
 * @param confirmColor Custom color for the confirm button.
 * @param confirmText Custom text for the confirm button.
 */
export async function verifySecurityToken(
  customText?: string,
  customTitle: string = 'Verifikasi Keamanan',
  confirmColor: string = '#dc2626',
  confirmText: string = 'OK'
): Promise<string | undefined> {
  const textMsg = customText || 'Masukkan Kode Token ID Server:';
  
  const result = await Swal.fire({
    title: customTitle,
    html: `
      <div class="text-center font-sans">
        <p class="text-slate-500 text-xs mb-4">${textMsg}</p>
        <div class="relative max-w-xs mx-auto flex items-center">
          <input 
            type="password" 
            id="swal-token-input" 
            class="swal2-input w-full pr-12 text-center text-sm rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-300" 
            placeholder="Kode Token"
            style="margin: 0; width: 100%; box-sizing: border-box; height: 42px; font-weight: bold; font-family: sans-serif; letter-spacing: 0.1em; border-radius: 0.75rem;"
          />
          <button 
            type="button" 
            id="swal-token-toggle" 
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center transition-colors"
            style="background: transparent; border: none; cursor: pointer; padding: 4px; z-index: 10;"
            title="Tampilkan Token"
          >
            <!-- Eye Icon (default visible when password type) -->
            <svg id="swal-eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <!-- Eye Off Icon (hidden initially) -->
            <svg id="swal-eye-off-icon" class="hidden" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
              <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
              <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
          </button>
        </div>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    heightAuto: false,
    focusConfirm: false,
    preConfirm: () => {
      const input = document.getElementById('swal-token-input') as HTMLInputElement;
      if (!input || !input.value.trim()) {
        Swal.showValidationMessage('Kode token wajib diisi');
        return false;
      }
      return input.value.trim();
    },
    didOpen: () => {
      const input = document.getElementById('swal-token-input') as HTMLInputElement;
      const toggle = document.getElementById('swal-token-toggle');
      const eyeIcon = document.getElementById('swal-eye-icon');
      const eyeOffIcon = document.getElementById('swal-eye-off-icon');

      if (input) {
        input.focus();
        // Support pressing enter to submit
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            Swal.clickConfirm();
          }
        });
      }

      if (toggle && input && eyeIcon && eyeOffIcon) {
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (input.type === 'password') {
            input.type = 'text';
            eyeIcon.classList.add('hidden');
            eyeOffIcon.classList.remove('hidden');
            toggle.setAttribute('title', 'Sembunyikan Token');
          } else {
            input.type = 'password';
            eyeIcon.classList.remove('hidden');
            eyeOffIcon.classList.add('hidden');
            toggle.setAttribute('title', 'Tampilkan Token');
          }
        });
      }
    }
  });

  return result.isConfirmed ? result.value : undefined;
}
