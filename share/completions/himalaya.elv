
use builtin;
use str;

set edit:completion:arg-completer[himalaya] = {|@words|
    fn spaces {|n|
        builtin:repeat $n ' ' | str:join ''
    }
    fn cand {|text desc|
        edit:complex-candidate $text &display=$text' '(spaces (- 14 (wcswidth $text)))$desc
    }
    var command = 'himalaya'
    for word $words[1..-1] {
        if (str:has-prefix $word '-') {
            break
        }
        set command = $command';'$word
    }
    var completions = [
        &'himalaya'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand mailbox 'Manage mailboxes using the shared API'
            cand mbox 'Manage mailboxes using the shared API'
            cand envelope 'Manage envelopes using the shared API'
            cand flag 'Manage flags using the shared API'
            cand message 'Manage messages using the shared API'
            cand msg 'Manage messages using the shared API'
            cand attachment 'Manage attachments using the shared API'
            cand imap 'IMAP-specific API'
            cand jmap 'JMAP-specific API'
            cand gmail 'Gmail-specific API'
            cand msgraph 'Microsoft Graph CLI'
            cand maildir 'Maildir-specific API'
            cand m2dir 'M2dir-specific API'
            cand smtp 'SMTP-specific API'
            cand configure 'Configure an account interactively'
            cand wizard 'Configure an account interactively'
            cand account 'Manage accounts defined in the TOML configuration file'
            cand completion 'Generate completion script for the give shell(s) to the given directory'
            cand manual 'Generate manual pages to the given directory'
            cand json-schema 'Generate JSON Schemas of every command''s JSON output to the given directory'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;mailbox'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'Shared API to list mailboxes for the active account'
            cand ls 'Shared API to list mailboxes for the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;mbox'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'Shared API to list mailboxes for the active account'
            cand ls 'Shared API to list mailboxes for the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;mailbox;list'= {
            cand -w 'Maximum width of the rendered table, in terminal columns'
            cand --max-width 'Maximum width of the rendered table, in terminal columns'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --counts 'Populate per-mailbox message counts (TOTAL and UNREAD columns)'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;mailbox;ls'= {
            cand -w 'Maximum width of the rendered table, in terminal columns'
            cand --max-width 'Maximum width of the rendered table, in terminal columns'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --counts 'Populate per-mailbox message counts (TOTAL and UNREAD columns)'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;mbox;list'= {
            cand -w 'Maximum width of the rendered table, in terminal columns'
            cand --max-width 'Maximum width of the rendered table, in terminal columns'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --counts 'Populate per-mailbox message counts (TOTAL and UNREAD columns)'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;mbox;ls'= {
            cand -w 'Maximum width of the rendered table, in terminal columns'
            cand --max-width 'Maximum width of the rendered table, in terminal columns'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --counts 'Populate per-mailbox message counts (TOTAL and UNREAD columns)'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;mailbox;help'= {
            cand list 'Shared API to list mailboxes for the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;mailbox;help;list'= {
        }
        &'himalaya;mailbox;help;help'= {
        }
        &'himalaya;mbox;help'= {
            cand list 'Shared API to list mailboxes for the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;mbox;help;list'= {
        }
        &'himalaya;mbox;help;help'= {
        }
        &'himalaya;envelope'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List envelopes for the active account, regardless of the underlying backend'
            cand ls 'List envelopes for the active account, regardless of the underlying backend'
            cand search 'Search envelopes for the active account using the shared search query DSL, regardless of the underlying backend'
            cand sr 'Search envelopes for the active account using the shared search query DSL, regardless of the underlying backend'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;envelope;list'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -p 'Page number, starting from 1. The most recent envelopes are on page 1'
            cand --page 'Page number, starting from 1. The most recent envelopes are on page 1'
            cand -s 'Maximum number of envelopes per page'
            cand --page-size 'Maximum number of envelopes per page'
            cand -w 'Maximum width of the rendered table, in terminal columns'
            cand --max-width 'Maximum width of the rendered table, in terminal columns'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand -r 'Render recipients (`To:`) instead of senders (`From:`). Useful for sent folders'
            cand --recipient 'Render recipients (`To:`) instead of senders (`From:`). Useful for sent folders'
            cand --has-attachment 'Populate the ATT column. Depending on the backend this can cost an extra lookup per envelope, so it is opt-in'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;envelope;ls'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -p 'Page number, starting from 1. The most recent envelopes are on page 1'
            cand --page 'Page number, starting from 1. The most recent envelopes are on page 1'
            cand -s 'Maximum number of envelopes per page'
            cand --page-size 'Maximum number of envelopes per page'
            cand -w 'Maximum width of the rendered table, in terminal columns'
            cand --max-width 'Maximum width of the rendered table, in terminal columns'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand -r 'Render recipients (`To:`) instead of senders (`From:`). Useful for sent folders'
            cand --recipient 'Render recipients (`To:`) instead of senders (`From:`). Useful for sent folders'
            cand --has-attachment 'Populate the ATT column. Depending on the backend this can cost an extra lookup per envelope, so it is opt-in'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;envelope;search'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -p 'Page number, starting from 1'
            cand --page 'Page number, starting from 1'
            cand -s 'Maximum number of envelopes per page'
            cand --page-size 'Maximum number of envelopes per page'
            cand -w 'Maximum width of the rendered table, in terminal columns'
            cand --max-width 'Maximum width of the rendered table, in terminal columns'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand -r 'Render recipients (`To:`) instead of senders (`From:`)'
            cand --recipient 'Render recipients (`To:`) instead of senders (`From:`)'
            cand --has-attachment 'Populate the ATT column'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;envelope;sr'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -p 'Page number, starting from 1'
            cand --page 'Page number, starting from 1'
            cand -s 'Maximum number of envelopes per page'
            cand --page-size 'Maximum number of envelopes per page'
            cand -w 'Maximum width of the rendered table, in terminal columns'
            cand --max-width 'Maximum width of the rendered table, in terminal columns'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand -r 'Render recipients (`To:`) instead of senders (`From:`)'
            cand --recipient 'Render recipients (`To:`) instead of senders (`From:`)'
            cand --has-attachment 'Populate the ATT column'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;envelope;help'= {
            cand list 'List envelopes for the active account, regardless of the underlying backend'
            cand search 'Search envelopes for the active account using the shared search query DSL, regardless of the underlying backend'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;envelope;help;list'= {
        }
        &'himalaya;envelope;help;search'= {
        }
        &'himalaya;envelope;help;help'= {
        }
        &'himalaya;flag'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand add 'Add flag(s) to message(s) for the active account'
            cand set 'Replace flag(s) of message(s) for the active account'
            cand remove 'Remove flag(s) from message(s) for the active account'
            cand rm 'Remove flag(s) from message(s) for the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;flag;add'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -f 'Flag(s) to apply. Repeat the option to pass several (e.g. `-f seen -f flagged`)'
            cand --flag 'Flag(s) to apply. Repeat the option to pass several (e.g. `-f seen -f flagged`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;flag;set'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -f 'Flag(s) to apply. Repeat the option to pass several (e.g. `-f seen -f flagged`)'
            cand --flag 'Flag(s) to apply. Repeat the option to pass several (e.g. `-f seen -f flagged`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;flag;remove'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -f 'Flag(s) to apply. Repeat the option to pass several (e.g. `-f seen -f flagged`)'
            cand --flag 'Flag(s) to apply. Repeat the option to pass several (e.g. `-f seen -f flagged`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;flag;rm'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -f 'Flag(s) to apply. Repeat the option to pass several (e.g. `-f seen -f flagged`)'
            cand --flag 'Flag(s) to apply. Repeat the option to pass several (e.g. `-f seen -f flagged`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;flag;help'= {
            cand add 'Add flag(s) to message(s) for the active account'
            cand set 'Replace flag(s) of message(s) for the active account'
            cand remove 'Remove flag(s) from message(s) for the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;flag;help;add'= {
        }
        &'himalaya;flag;help;set'= {
        }
        &'himalaya;flag;help;remove'= {
        }
        &'himalaya;flag;help;help'= {
        }
        &'himalaya;message'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand add 'Add a raw RFC 5322 message to a mailbox'
            cand save 'Add a raw RFC 5322 message to a mailbox'
            cand compose 'Compose a new message from CLI arguments (built-in flag composer)'
            cand write 'Compose a new message from CLI arguments (built-in flag composer)'
            cand copy 'Copy message(s) from one mailbox to another within the active account'
            cand cp 'Copy message(s) from one mailbox to another within the active account'
            cand delete 'Delete message(s) from the active account'
            cand rm 'Delete message(s) from the active account'
            cand forward 'Forward a message using the built-in flag composer'
            cand fwd 'Forward a message using the built-in flag composer'
            cand move 'Move message(s) from one mailbox to another within the active account'
            cand mv 'Move message(s) from one mailbox to another within the active account'
            cand read 'Read a message from the active account (built-in flag reader)'
            cand reply 'Reply to a message using the built-in flag composer'
            cand send 'Send a message via the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msg'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand add 'Add a raw RFC 5322 message to a mailbox'
            cand save 'Add a raw RFC 5322 message to a mailbox'
            cand compose 'Compose a new message from CLI arguments (built-in flag composer)'
            cand write 'Compose a new message from CLI arguments (built-in flag composer)'
            cand copy 'Copy message(s) from one mailbox to another within the active account'
            cand cp 'Copy message(s) from one mailbox to another within the active account'
            cand delete 'Delete message(s) from the active account'
            cand rm 'Delete message(s) from the active account'
            cand forward 'Forward a message using the built-in flag composer'
            cand fwd 'Forward a message using the built-in flag composer'
            cand move 'Move message(s) from one mailbox to another within the active account'
            cand mv 'Move message(s) from one mailbox to another within the active account'
            cand read 'Read a message from the active account (built-in flag reader)'
            cand reply 'Reply to a message using the built-in flag composer'
            cand send 'Send a message via the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;message;add'= {
            cand -m 'Destination mailbox name or alias. Mandatory'
            cand --mailbox 'Destination mailbox name or alias. Mandatory'
            cand -f 'Flag(s) to set on the new message. Optional'
            cand --flag 'Flag(s) to set on the new message. Optional'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'Send the message after appending it. Combines with the mandatory `--mailbox` to save-then-send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;save'= {
            cand -m 'Destination mailbox name or alias. Mandatory'
            cand --mailbox 'Destination mailbox name or alias. Mandatory'
            cand -f 'Flag(s) to set on the new message. Optional'
            cand --flag 'Flag(s) to set on the new message. Optional'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'Send the message after appending it. Combines with the mandatory `--mailbox` to save-then-send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;add'= {
            cand -m 'Destination mailbox name or alias. Mandatory'
            cand --mailbox 'Destination mailbox name or alias. Mandatory'
            cand -f 'Flag(s) to set on the new message. Optional'
            cand --flag 'Flag(s) to set on the new message. Optional'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'Send the message after appending it. Combines with the mandatory `--mailbox` to save-then-send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;save'= {
            cand -m 'Destination mailbox name or alias. Mandatory'
            cand --mailbox 'Destination mailbox name or alias. Mandatory'
            cand -f 'Flag(s) to set on the new message. Optional'
            cand --flag 'Flag(s) to set on the new message. Optional'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'Send the message after appending it. Combines with the mandatory `--mailbox` to save-then-send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;compose'= {
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'Read the body from a file. Mutually exclusive with `--body` and stdin'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'Read the signature from a file. Mutually exclusive with `--signature`'
            cand --save 'Append a copy of the composed message to this mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'Send the composed message through the account''s SMTP/JMAP path. Combines with `--save` to also keep a copy'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;write'= {
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'Read the body from a file. Mutually exclusive with `--body` and stdin'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'Read the signature from a file. Mutually exclusive with `--signature`'
            cand --save 'Append a copy of the composed message to this mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'Send the composed message through the account''s SMTP/JMAP path. Combines with `--save` to also keep a copy'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;compose'= {
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'Read the body from a file. Mutually exclusive with `--body` and stdin'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'Read the signature from a file. Mutually exclusive with `--signature`'
            cand --save 'Append a copy of the composed message to this mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'Send the composed message through the account''s SMTP/JMAP path. Combines with `--save` to also keep a copy'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;write'= {
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'Read the body from a file. Mutually exclusive with `--body` and stdin'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'Read the signature from a file. Mutually exclusive with `--signature`'
            cand --save 'Append a copy of the composed message to this mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'Send the composed message through the account''s SMTP/JMAP path. Combines with `--save` to also keep a copy'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;copy'= {
            cand -f 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand --from 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand -t 'Destination mailbox name or alias. Mandatory'
            cand --to 'Destination mailbox name or alias. Mandatory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;cp'= {
            cand -f 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand --from 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand -t 'Destination mailbox name or alias. Mandatory'
            cand --to 'Destination mailbox name or alias. Mandatory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;copy'= {
            cand -f 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand --from 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand -t 'Destination mailbox name or alias. Mandatory'
            cand --to 'Destination mailbox name or alias. Mandatory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;cp'= {
            cand -f 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand --from 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand -t 'Destination mailbox name or alias. Mandatory'
            cand --to 'Destination mailbox name or alias. Mandatory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;delete'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;rm'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;delete'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;rm'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;forward'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'body-file'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'signature-file'
            cand -P 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user; write your message inside the quoted block'
            cand --posting-style 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user; write your message inside the quoted block'
            cand -Q 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --quote-headline 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --save 'save'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;fwd'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'body-file'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'signature-file'
            cand -P 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user; write your message inside the quoted block'
            cand --posting-style 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user; write your message inside the quoted block'
            cand -Q 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --quote-headline 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --save 'save'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;forward'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'body-file'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'signature-file'
            cand -P 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user; write your message inside the quoted block'
            cand --posting-style 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user; write your message inside the quoted block'
            cand -Q 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --quote-headline 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --save 'save'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;fwd'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'body-file'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'signature-file'
            cand -P 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user; write your message inside the quoted block'
            cand --posting-style 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user; write your message inside the quoted block'
            cand -Q 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --quote-headline 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --save 'save'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;move'= {
            cand -f 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand --from 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand -t 'Destination mailbox name or alias. Mandatory'
            cand --to 'Destination mailbox name or alias. Mandatory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;mv'= {
            cand -f 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand --from 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand -t 'Destination mailbox name or alias. Mandatory'
            cand --to 'Destination mailbox name or alias. Mandatory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;move'= {
            cand -f 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand --from 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand -t 'Destination mailbox name or alias. Mandatory'
            cand --to 'Destination mailbox name or alias. Mandatory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;mv'= {
            cand -f 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand --from 'Source mailbox name or alias. Omit to fall back to the `inbox` alias (errors when none is configured, as the shared layer cannot guess a backend''s inbox id)'
            cand -t 'Destination mailbox name or alias. Mandatory'
            cand --to 'Destination mailbox name or alias. Mandatory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;read'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --raw 'Write the raw RFC 5322 bytes to stdout. With the global `--json` flag the bytes are emitted as a JSON `{ "message": "…" }` string instead, keeping the output valid JSON'
            cand --seen 'Mark the message as seen while reading it. Without this flag the read leaves the seen state untouched'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;read'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --raw 'Write the raw RFC 5322 bytes to stdout. With the global `--json` flag the bytes are emitted as a JSON `{ "message": "…" }` string instead, keeping the output valid JSON'
            cand --seen 'Mark the message as seen while reading it. Without this flag the read leaves the seen state untouched'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;reply'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'body-file'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'signature-file'
            cand -P 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user — write your reply inside the quoted block'
            cand --posting-style 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user — write your reply inside the quoted block'
            cand -Q 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --quote-headline 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --save 'save'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;reply'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --from 'Sender address (`From` header). Defaults to the account''s `email`, named by its `display-name`'
            cand -t 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --to 'Recipient address(es) (`To` header). Repeat the flag or use a comma-separated list'
            cand --cc 'Carbon-copy recipient(s) (`Cc` header)'
            cand --bcc 'Blind carbon-copy recipient(s) (`Bcc` header)'
            cand -s 'Subject line'
            cand --subject 'Subject line'
            cand --body 'Inline body. Conflicts with `--body-file`; stdin is used as a fallback when neither is given'
            cand --body-file 'body-file'
            cand --attach 'Attachment file(s)'
            cand --signature 'Signature appended after the body, introduced by the account''s `signature-delim` (RFC 3676 §4.3 `-- ` by default). Defaults to the account''s `signature`'
            cand --signature-file 'signature-file'
            cand -P 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user — write your reply inside the quoted block'
            cand --posting-style 'How to lay out the quoted source body relative to the user''s body. Interleaved posting is left to the user — write your reply inside the quoted block'
            cand -Q 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --quote-headline 'Plain-text headline placed before the quoted source body (e.g. `"On {date}, {from} wrote:"`). No substitution is performed; pass the literal string you want'
            cand --save 'save'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --send 'send'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;send'= {
            cand --save 'Append a copy of the sent message to this mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msg;send'= {
            cand --save 'Append a copy of the sent message to this mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;message;help'= {
            cand add 'Add a raw RFC 5322 message to a mailbox'
            cand compose 'Compose a new message from CLI arguments (built-in flag composer)'
            cand copy 'Copy message(s) from one mailbox to another within the active account'
            cand delete 'Delete message(s) from the active account'
            cand forward 'Forward a message using the built-in flag composer'
            cand move 'Move message(s) from one mailbox to another within the active account'
            cand read 'Read a message from the active account (built-in flag reader)'
            cand reply 'Reply to a message using the built-in flag composer'
            cand send 'Send a message via the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;message;help;add'= {
        }
        &'himalaya;message;help;compose'= {
        }
        &'himalaya;message;help;copy'= {
        }
        &'himalaya;message;help;delete'= {
        }
        &'himalaya;message;help;forward'= {
        }
        &'himalaya;message;help;move'= {
        }
        &'himalaya;message;help;read'= {
        }
        &'himalaya;message;help;reply'= {
        }
        &'himalaya;message;help;send'= {
        }
        &'himalaya;message;help;help'= {
        }
        &'himalaya;msg;help'= {
            cand add 'Add a raw RFC 5322 message to a mailbox'
            cand compose 'Compose a new message from CLI arguments (built-in flag composer)'
            cand copy 'Copy message(s) from one mailbox to another within the active account'
            cand delete 'Delete message(s) from the active account'
            cand forward 'Forward a message using the built-in flag composer'
            cand move 'Move message(s) from one mailbox to another within the active account'
            cand read 'Read a message from the active account (built-in flag reader)'
            cand reply 'Reply to a message using the built-in flag composer'
            cand send 'Send a message via the active account'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msg;help;add'= {
        }
        &'himalaya;msg;help;compose'= {
        }
        &'himalaya;msg;help;copy'= {
        }
        &'himalaya;msg;help;delete'= {
        }
        &'himalaya;msg;help;forward'= {
        }
        &'himalaya;msg;help;move'= {
        }
        &'himalaya;msg;help;read'= {
        }
        &'himalaya;msg;help;reply'= {
        }
        &'himalaya;msg;help;send'= {
        }
        &'himalaya;msg;help;help'= {
        }
        &'himalaya;attachment'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List the attachments carried by a single message in the active account'
            cand ls 'List the attachments carried by a single message in the active account'
            cand download 'Download specific attachments of a single message to disk'
            cand dl 'Download specific attachments of a single message to disk'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;attachment;list'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand -i 'Include parts with `Content-Disposition: inline`'
            cand --inline 'Include parts with `Content-Disposition: inline`'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;attachment;ls'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand -i 'Include parts with `Content-Disposition: inline`'
            cand --inline 'Include parts with `Content-Disposition: inline`'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;attachment;download'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -d 'Destination directory'
            cand --dir 'Destination directory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;attachment;dl'= {
            cand -m 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand --mailbox 'Mailbox name. Looked up against `[mailbox.alias]` case-insensitively; raw backend-native ids are accepted too and returned verbatim when no alias matches. Omit to fall back to the id mapped to the `inbox` alias'
            cand -d 'Destination directory'
            cand --dir 'Destination directory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;attachment;help'= {
            cand list 'List the attachments carried by a single message in the active account'
            cand download 'Download specific attachments of a single message to disk'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;attachment;help;list'= {
        }
        &'himalaya;attachment;help;download'= {
        }
        &'himalaya;attachment;help;help'= {
        }
        &'himalaya;imap'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand id 'Get information about the IMAP server'
            cand select 'Select the given mailbox (SELECT, RFC 3501)'
            cand create 'Create the given mailbox (CREATE, RFC 3501)'
            cand delete 'Delete the given mailbox (DELETE, RFC 3501)'
            cand rename 'Rename the given mailbox (RENAME, RFC 3501)'
            cand subscribe 'Subscribe to the given mailbox (SUBSCRIBE, RFC 3501)'
            cand unsubscribe 'Unsubscribe from the given mailbox (UNSUBSCRIBE, RFC 3501)'
            cand list 'List mailboxes (LIST / LSUB, RFC 3501)'
            cand status 'Get the status of the given mailbox (STATUS, RFC 3501)'
            cand close 'Close the selected mailbox (CLOSE, RFC 3501)'
            cand unselect 'Unselect the selected mailbox (UNSELECT, RFC 3691)'
            cand expunge 'Expunge the given mailbox (EXPUNGE, RFC 3501)'
            cand search 'Search IMAP messages (SEARCH, RFC 3501)'
            cand sort 'Sort IMAP messages (SORT, RFC 5256)'
            cand thread 'Thread IMAP messages (THREAD, RFC 5256)'
            cand store 'Store IMAP flags on message(s) (STORE, RFC 3501)'
            cand flags 'List the flags available in the given mailbox (SELECT response, RFC 3501)'
            cand fetch 'Fetch IMAP message data items (FETCH, RFC 3501)'
            cand append 'Append a message to a mailbox (APPEND, RFC 3501)'
            cand copy 'Copy IMAP message(s) to the given mailbox (COPY, RFC 3501)'
            cand move 'Move IMAP message(s) to the given mailbox (MOVE, RFC 6851)'
            cand raw 'Send one or more raw IMAP commands and print the verbatim server response'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;imap;id'= {
            cand -p 'p'
            cand --parameter 'parameter'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;select'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;rename'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;subscribe'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;unsubscribe'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;list'= {
            cand -r 'The reference name for the LIST/LSUB command'
            cand --reference 'The reference name for the LIST/LSUB command'
            cand -p 'The mailbox name pattern with wildcards (* and %)'
            cand --pattern 'The mailbox name pattern with wildcards (* and %)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand -A 'List all mailboxes, not just subscribed ones'
            cand --all 'List all mailboxes, not just subscribed ones'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;status'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;close'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;unselect'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;expunge'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --no-select 'Do not select the given mailbox before performing the current action'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;search'= {
            cand -m 'The name of the mailbox'
            cand --mailbox 'The name of the mailbox'
            cand --from 'Match messages whose From header contains TEXT'
            cand --to 'Match messages whose To header contains TEXT'
            cand --cc 'Match messages whose Cc header contains TEXT'
            cand --bcc 'Match messages whose Bcc header contains TEXT'
            cand --subject 'Match messages whose Subject header contains TEXT'
            cand --body 'Match messages whose body contains TEXT'
            cand --text 'Match messages whose headers or body contain TEXT'
            cand --before 'Match messages received before DATE (YYYY-MM-DD)'
            cand --since 'Match messages received since DATE (YYYY-MM-DD)'
            cand --on 'Match messages received on DATE (YYYY-MM-DD)'
            cand --larger 'Match messages larger than BYTES'
            cand --smaller 'Match messages smaller than BYTES'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --no-select 'Do not select the given mailbox before performing the current action'
            cand --seen 'Match \Seen messages'
            cand --unseen 'Match messages without the \Seen flag'
            cand --flagged 'Match \Flagged messages'
            cand --unflagged 'Match messages without the \Flagged flag'
            cand --answered 'Match \Answered messages'
            cand --unanswered 'Match messages without the \Answered flag'
            cand --deleted 'Match \Deleted messages'
            cand --undeleted 'Match messages without the \Deleted flag'
            cand --draft 'Match \Draft messages'
            cand --undraft 'Match messages without the \Draft flag'
            cand --new 'Match \Recent messages that are also unseen (NEW)'
            cand --old 'Match messages without the \Recent flag (OLD)'
            cand --recent 'Match \Recent messages'
            cand --seq 'Use sequence numbers instead of UIDs'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;sort'= {
            cand -m 'The name of the mailbox'
            cand --mailbox 'The name of the mailbox'
            cand -S 'Sort key'
            cand --sort 'Sort key'
            cand --from 'Match messages whose From header contains TEXT'
            cand --to 'Match messages whose To header contains TEXT'
            cand --cc 'Match messages whose Cc header contains TEXT'
            cand --bcc 'Match messages whose Bcc header contains TEXT'
            cand --subject 'Match messages whose Subject header contains TEXT'
            cand --body 'Match messages whose body contains TEXT'
            cand --text 'Match messages whose headers or body contain TEXT'
            cand --before 'Match messages received before DATE (YYYY-MM-DD)'
            cand --since 'Match messages received since DATE (YYYY-MM-DD)'
            cand --on 'Match messages received on DATE (YYYY-MM-DD)'
            cand --larger 'Match messages larger than BYTES'
            cand --smaller 'Match messages smaller than BYTES'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --no-select 'Do not select the given mailbox before performing the current action'
            cand -r 'Reverse sort order'
            cand --reverse 'Reverse sort order'
            cand --seen 'Match \Seen messages'
            cand --unseen 'Match messages without the \Seen flag'
            cand --flagged 'Match \Flagged messages'
            cand --unflagged 'Match messages without the \Flagged flag'
            cand --answered 'Match \Answered messages'
            cand --unanswered 'Match messages without the \Answered flag'
            cand --deleted 'Match \Deleted messages'
            cand --undeleted 'Match messages without the \Deleted flag'
            cand --draft 'Match \Draft messages'
            cand --undraft 'Match messages without the \Draft flag'
            cand --new 'Match \Recent messages that are also unseen (NEW)'
            cand --old 'Match messages without the \Recent flag (OLD)'
            cand --recent 'Match \Recent messages'
            cand --seq 'Use sequence numbers instead of UIDs'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;thread'= {
            cand -m 'The name of the mailbox'
            cand --mailbox 'The name of the mailbox'
            cand -A 'Threading algorithm'
            cand --algorithm 'Threading algorithm'
            cand --from 'Match messages whose From header contains TEXT'
            cand --to 'Match messages whose To header contains TEXT'
            cand --cc 'Match messages whose Cc header contains TEXT'
            cand --bcc 'Match messages whose Bcc header contains TEXT'
            cand --subject 'Match messages whose Subject header contains TEXT'
            cand --body 'Match messages whose body contains TEXT'
            cand --text 'Match messages whose headers or body contain TEXT'
            cand --before 'Match messages received before DATE (YYYY-MM-DD)'
            cand --since 'Match messages received since DATE (YYYY-MM-DD)'
            cand --on 'Match messages received on DATE (YYYY-MM-DD)'
            cand --larger 'Match messages larger than BYTES'
            cand --smaller 'Match messages smaller than BYTES'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --no-select 'Do not select the given mailbox before performing the current action'
            cand --seen 'Match \Seen messages'
            cand --unseen 'Match messages without the \Seen flag'
            cand --flagged 'Match \Flagged messages'
            cand --unflagged 'Match messages without the \Flagged flag'
            cand --answered 'Match \Answered messages'
            cand --unanswered 'Match messages without the \Answered flag'
            cand --deleted 'Match \Deleted messages'
            cand --undeleted 'Match messages without the \Deleted flag'
            cand --draft 'Match \Draft messages'
            cand --undraft 'Match messages without the \Draft flag'
            cand --new 'Match \Recent messages that are also unseen (NEW)'
            cand --old 'Match messages without the \Recent flag (OLD)'
            cand --recent 'Match \Recent messages'
            cand --seq 'Use sequence numbers instead of UIDs'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;store'= {
            cand -m 'The name of the mailbox'
            cand --mailbox 'The name of the mailbox'
            cand --action 'How to apply the flags'
            cand -f 'Flags as raw IMAP tokens (RFC 3501) — this is the raw IMAP API, NOT the shared `seen|answered|flagged|draft` enum. System flags keep their backslash: `-f ''\Seen''`, `-f ''\Flagged''`. A bare word is a custom keyword: `-f seen` stores the keyword `seen`, not the `\Seen` system flag. Use the shared `flag add -f seen` for the enum-mapped behaviour'
            cand --flag 'Flags as raw IMAP tokens (RFC 3501) — this is the raw IMAP API, NOT the shared `seen|answered|flagged|draft` enum. System flags keep their backslash: `-f ''\Seen''`, `-f ''\Flagged''`. A bare word is a custom keyword: `-f seen` stores the keyword `seen`, not the `\Seen` system flag. Use the shared `flag add -f seen` for the enum-mapped behaviour'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --no-select 'Do not select the given mailbox before performing the current action'
            cand --seq 'Use sequence numbers instead of UIDs'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;flags'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;fetch'= {
            cand -m 'The name of the mailbox'
            cand --mailbox 'The name of the mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --no-select 'Do not select the given mailbox before performing the current action'
            cand --envelope 'Fetch the envelope (date, subject, from, to, cc, ...)'
            cand --structure 'Fetch the MIME body structure tree'
            cand --flags 'Fetch the flags set on the message'
            cand --internal-date 'Fetch the internal (server) date'
            cand --size 'Fetch the size in octets'
            cand --seq 'Use sequence numbers instead of UIDs'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;append'= {
            cand -f 'Flags to set on the appended message, as raw IMAP tokens (RFC 3501) — this is the raw IMAP API, NOT the shared `seen|answered|flagged|draft` enum. System flags keep their backslash: `-f ''\Seen''`, `-f ''\Flagged''`. A bare word is a custom keyword: `-f seen` stores the keyword `seen`, not the `\Seen` system flag (so `imap search --seen` will NOT match it). Use the shared `message add -f seen` for the enum-mapped behaviour'
            cand --flag 'Flags to set on the appended message, as raw IMAP tokens (RFC 3501) — this is the raw IMAP API, NOT the shared `seen|answered|flagged|draft` enum. System flags keep their backslash: `-f ''\Seen''`, `-f ''\Flagged''`. A bare word is a custom keyword: `-f seen` stores the keyword `seen`, not the `\Seen` system flag (so `imap search --seen` will NOT match it). Use the shared `message add -f seen` for the enum-mapped behaviour'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;copy'= {
            cand -m 'The name of the mailbox'
            cand --mailbox 'The name of the mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --no-select 'Do not select the given mailbox before performing the current action'
            cand --seq 'Use sequence numbers instead of UIDs'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;move'= {
            cand -m 'The name of the mailbox'
            cand --mailbox 'The name of the mailbox'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --no-select 'Do not select the given mailbox before performing the current action'
            cand --seq 'Use sequence numbers instead of UIDs'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;raw'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;imap;help'= {
            cand id 'Get information about the IMAP server'
            cand select 'Select the given mailbox (SELECT, RFC 3501)'
            cand create 'Create the given mailbox (CREATE, RFC 3501)'
            cand delete 'Delete the given mailbox (DELETE, RFC 3501)'
            cand rename 'Rename the given mailbox (RENAME, RFC 3501)'
            cand subscribe 'Subscribe to the given mailbox (SUBSCRIBE, RFC 3501)'
            cand unsubscribe 'Unsubscribe from the given mailbox (UNSUBSCRIBE, RFC 3501)'
            cand list 'List mailboxes (LIST / LSUB, RFC 3501)'
            cand status 'Get the status of the given mailbox (STATUS, RFC 3501)'
            cand close 'Close the selected mailbox (CLOSE, RFC 3501)'
            cand unselect 'Unselect the selected mailbox (UNSELECT, RFC 3691)'
            cand expunge 'Expunge the given mailbox (EXPUNGE, RFC 3501)'
            cand search 'Search IMAP messages (SEARCH, RFC 3501)'
            cand sort 'Sort IMAP messages (SORT, RFC 5256)'
            cand thread 'Thread IMAP messages (THREAD, RFC 5256)'
            cand store 'Store IMAP flags on message(s) (STORE, RFC 3501)'
            cand flags 'List the flags available in the given mailbox (SELECT response, RFC 3501)'
            cand fetch 'Fetch IMAP message data items (FETCH, RFC 3501)'
            cand append 'Append a message to a mailbox (APPEND, RFC 3501)'
            cand copy 'Copy IMAP message(s) to the given mailbox (COPY, RFC 3501)'
            cand move 'Move IMAP message(s) to the given mailbox (MOVE, RFC 6851)'
            cand raw 'Send one or more raw IMAP commands and print the verbatim server response'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;imap;help;id'= {
        }
        &'himalaya;imap;help;select'= {
        }
        &'himalaya;imap;help;create'= {
        }
        &'himalaya;imap;help;delete'= {
        }
        &'himalaya;imap;help;rename'= {
        }
        &'himalaya;imap;help;subscribe'= {
        }
        &'himalaya;imap;help;unsubscribe'= {
        }
        &'himalaya;imap;help;list'= {
        }
        &'himalaya;imap;help;status'= {
        }
        &'himalaya;imap;help;close'= {
        }
        &'himalaya;imap;help;unselect'= {
        }
        &'himalaya;imap;help;expunge'= {
        }
        &'himalaya;imap;help;search'= {
        }
        &'himalaya;imap;help;sort'= {
        }
        &'himalaya;imap;help;thread'= {
        }
        &'himalaya;imap;help;store'= {
        }
        &'himalaya;imap;help;flags'= {
        }
        &'himalaya;imap;help;fetch'= {
        }
        &'himalaya;imap;help;append'= {
        }
        &'himalaya;imap;help;copy'= {
        }
        &'himalaya;imap;help;move'= {
        }
        &'himalaya;imap;help;raw'= {
        }
        &'himalaya;imap;help;help'= {
        }
        &'himalaya;jmap'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand query 'Send a raw JMAP method-calls array and print the response'
            cand mailbox 'Manage JMAP mailboxes'
            cand mbox 'Manage JMAP mailboxes'
            cand email 'Manage JMAP emails'
            cand thread 'Manage JMAP threads'
            cand identity 'Manage JMAP sender identities'
            cand submission 'Manage JMAP email submissions'
            cand vacation-response 'Manage JMAP vacation response'
            cand vacation 'Manage JMAP vacation response'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;query'= {
            cand --using 'Extra capability URNs to declare (core and mail are always included)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get JMAP mailboxes by ID (Mailbox/get)'
            cand query 'Query JMAP mailboxes (Mailbox/query + Mailbox/get)'
            cand create 'Create a JMAP mailbox'
            cand add 'Create a JMAP mailbox'
            cand new 'Create a JMAP mailbox'
            cand update 'Update a JMAP mailbox'
            cand destroy 'Delete a JMAP mailbox'
            cand delete 'Delete a JMAP mailbox'
            cand del 'Delete a JMAP mailbox'
            cand remove 'Delete a JMAP mailbox'
            cand rm 'Delete a JMAP mailbox'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;mbox'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get JMAP mailboxes by ID (Mailbox/get)'
            cand query 'Query JMAP mailboxes (Mailbox/query + Mailbox/get)'
            cand create 'Create a JMAP mailbox'
            cand add 'Create a JMAP mailbox'
            cand new 'Create a JMAP mailbox'
            cand update 'Update a JMAP mailbox'
            cand destroy 'Delete a JMAP mailbox'
            cand delete 'Delete a JMAP mailbox'
            cand del 'Delete a JMAP mailbox'
            cand remove 'Delete a JMAP mailbox'
            cand rm 'Delete a JMAP mailbox'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;mailbox;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;query'= {
            cand --parent-id 'Filter by parent mailbox identifier'
            cand --role 'Filter by a standard role'
            cand --custom-role 'Filter by a custom (non-standard) role'
            cand --name 'Filter by substring name match'
            cand --sort 'Sort by property'
            cand -s 'Number of mailboxes to display per page'
            cand --page-size 'Number of mailboxes to display per page'
            cand -p 'Page index, starting from 1'
            cand --page 'Page index, starting from 1'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribed 'Restrict to subscribed mailboxes. Native `Mailbox/query` applies no subscription filter, so the default lists every mailbox'
            cand --has-any-role 'Only return mailboxes that have a role'
            cand --desc 'Sort in descending order'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;query'= {
            cand --parent-id 'Filter by parent mailbox identifier'
            cand --role 'Filter by a standard role'
            cand --custom-role 'Filter by a custom (non-standard) role'
            cand --name 'Filter by substring name match'
            cand --sort 'Sort by property'
            cand -s 'Number of mailboxes to display per page'
            cand --page-size 'Number of mailboxes to display per page'
            cand -p 'Page index, starting from 1'
            cand --page 'Page index, starting from 1'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribed 'Restrict to subscribed mailboxes. Native `Mailbox/query` applies no subscription filter, so the default lists every mailbox'
            cand --has-any-role 'Only return mailboxes that have a role'
            cand --desc 'Sort in descending order'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;create'= {
            cand --parent-id 'Attach the new mailbox to the parent mailbox matching the given identifier'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribe 'Should subscribe to the new mailbox'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;add'= {
            cand --parent-id 'Attach the new mailbox to the parent mailbox matching the given identifier'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribe 'Should subscribe to the new mailbox'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;new'= {
            cand --parent-id 'Attach the new mailbox to the parent mailbox matching the given identifier'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribe 'Should subscribe to the new mailbox'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;create'= {
            cand --parent-id 'Attach the new mailbox to the parent mailbox matching the given identifier'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribe 'Should subscribe to the new mailbox'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;add'= {
            cand --parent-id 'Attach the new mailbox to the parent mailbox matching the given identifier'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribe 'Should subscribe to the new mailbox'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;new'= {
            cand --parent-id 'Attach the new mailbox to the parent mailbox matching the given identifier'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribe 'Should subscribe to the new mailbox'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;update'= {
            cand --name 'New display name'
            cand --parent-id 'New parent mailbox ID'
            cand --role 'Set a standard role'
            cand --custom-role 'Set a custom (non-standard) role'
            cand --sort-order 'New sort order'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribe 'Subscribe to the mailbox'
            cand --unsubscribe 'Unsubscribe from the mailbox'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;update'= {
            cand --name 'New display name'
            cand --parent-id 'New parent mailbox ID'
            cand --role 'Set a standard role'
            cand --custom-role 'Set a custom (non-standard) role'
            cand --sort-order 'New sort order'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --subscribe 'Subscribe to the mailbox'
            cand --unsubscribe 'Unsubscribe from the mailbox'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;destroy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;destroy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mbox;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --purge 'Destroy all emails in the mailbox when deleting'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;mailbox;help'= {
            cand get 'Get JMAP mailboxes by ID (Mailbox/get)'
            cand query 'Query JMAP mailboxes (Mailbox/query + Mailbox/get)'
            cand create 'Create a JMAP mailbox'
            cand update 'Update a JMAP mailbox'
            cand destroy 'Delete a JMAP mailbox'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;mailbox;help;get'= {
        }
        &'himalaya;jmap;mailbox;help;query'= {
        }
        &'himalaya;jmap;mailbox;help;create'= {
        }
        &'himalaya;jmap;mailbox;help;update'= {
        }
        &'himalaya;jmap;mailbox;help;destroy'= {
        }
        &'himalaya;jmap;mailbox;help;help'= {
        }
        &'himalaya;jmap;mbox;help'= {
            cand get 'Get JMAP mailboxes by ID (Mailbox/get)'
            cand query 'Query JMAP mailboxes (Mailbox/query + Mailbox/get)'
            cand create 'Create a JMAP mailbox'
            cand update 'Update a JMAP mailbox'
            cand destroy 'Delete a JMAP mailbox'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;mbox;help;get'= {
        }
        &'himalaya;jmap;mbox;help;query'= {
        }
        &'himalaya;jmap;mbox;help;create'= {
        }
        &'himalaya;jmap;mbox;help;update'= {
        }
        &'himalaya;jmap;mbox;help;destroy'= {
        }
        &'himalaya;jmap;mbox;help;help'= {
        }
        &'himalaya;jmap;email'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get JMAP emails by ID (Email/get)'
            cand query 'Query JMAP emails (Email/query + Email/get)'
            cand read 'Read the content of a JMAP email (Email/get with body)'
            cand update 'Update JMAP emails via patch operations (Email/set)'
            cand delete 'Delete JMAP emails (Email/set destroy)'
            cand copy 'Copy JMAP emails from another account (Email/copy)'
            cand export 'Export a raw RFC 5322 message to stdout (Email/get + blob download)'
            cand import 'Import an RFC 5322 message into a mailbox (upload + Email/import)'
            cand parse 'Parse RFC 5322 message blobs without storing them (Email/parse)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;email;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;query'= {
            cand -m 'Filter by mailbox ID'
            cand --mailbox 'Filter by mailbox ID'
            cand --before 'Filter by received-before date (RFC 3339, e.g. 2024-01-01T00:00:00Z)'
            cand --after 'Filter by received-after date (RFC 3339, e.g. 2024-01-01T00:00:00Z)'
            cand --min-size 'Filter by minimum size in bytes'
            cand --max-size 'Filter by maximum size in bytes'
            cand --has-keyword 'Filter to emails that have this keyword set'
            cand --not-keyword 'Filter to emails that do not have this keyword set'
            cand --text 'Full-text search across all headers and body'
            cand --from 'Filter by From header (substring match)'
            cand --to 'Filter by To header (substring match)'
            cand --subject 'Filter by Subject header (substring match)'
            cand --body 'Filter by email body (substring match)'
            cand --sort 'Sort by property'
            cand -s 'Number of emails to display per page'
            cand --page-size 'Number of emails to display per page'
            cand -p 'Page index, starting from 1'
            cand --page 'Page index, starting from 1'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --has-attachment 'Filter to emails that have at least one attachment'
            cand --desc 'Sort in descending order'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;read'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --html 'Show HTML body instead of plain text'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;update'= {
            cand --add-keyword 'Add keyword(s) to the email(s)'
            cand --remove-keyword 'Remove keyword(s) from the email(s)'
            cand --keywords 'Replace all keywords atomically'
            cand --add-mailbox 'Add email(s) to a mailbox'
            cand --remove-mailbox 'Remove email(s) from a mailbox'
            cand --mailboxes 'Replace all mailbox memberships atomically'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;copy'= {
            cand --from-account 'Source account ID to copy from'
            cand --mailbox-id 'Destination mailbox ID(s) to place copies in'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;export'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;import'= {
            cand --mailbox-id 'Mailbox ID(s) to place the imported email in'
            cand --keyword 'Keywords to set on the imported email (e.g. `$seen`)'
            cand --received-at 'Override the `receivedAt` timestamp (RFC 3339)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --upload-only 'Only upload the blob and print the blobId; skip Email/import'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;parse'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;email;help'= {
            cand get 'Get JMAP emails by ID (Email/get)'
            cand query 'Query JMAP emails (Email/query + Email/get)'
            cand read 'Read the content of a JMAP email (Email/get with body)'
            cand update 'Update JMAP emails via patch operations (Email/set)'
            cand delete 'Delete JMAP emails (Email/set destroy)'
            cand copy 'Copy JMAP emails from another account (Email/copy)'
            cand export 'Export a raw RFC 5322 message to stdout (Email/get + blob download)'
            cand import 'Import an RFC 5322 message into a mailbox (upload + Email/import)'
            cand parse 'Parse RFC 5322 message blobs without storing them (Email/parse)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;email;help;get'= {
        }
        &'himalaya;jmap;email;help;query'= {
        }
        &'himalaya;jmap;email;help;read'= {
        }
        &'himalaya;jmap;email;help;update'= {
        }
        &'himalaya;jmap;email;help;delete'= {
        }
        &'himalaya;jmap;email;help;copy'= {
        }
        &'himalaya;jmap;email;help;export'= {
        }
        &'himalaya;jmap;email;help;import'= {
        }
        &'himalaya;jmap;email;help;parse'= {
        }
        &'himalaya;jmap;email;help;help'= {
        }
        &'himalaya;jmap;thread'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Fetch threads by ID (Thread/get)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;thread;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;thread;help'= {
            cand get 'Fetch threads by ID (Thread/get)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;thread;help;get'= {
        }
        &'himalaya;jmap;thread;help;help'= {
        }
        &'himalaya;jmap;identity'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Fetch identities (Identity/get)'
            cand create 'Create a new identity (Identity/set)'
            cand update 'Update an existing identity (Identity/set)'
            cand delete 'Delete an identity (Identity/set)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;identity;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;identity;create'= {
            cand --text-signature 'Plaintext signature to append to outgoing emails'
            cand --html-signature 'HTML signature to append to outgoing emails'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;identity;update'= {
            cand --name 'New display name'
            cand --text-signature 'New plaintext signature'
            cand --html-signature 'New HTML signature'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;identity;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;identity;help'= {
            cand get 'Fetch identities (Identity/get)'
            cand create 'Create a new identity (Identity/set)'
            cand update 'Update an existing identity (Identity/set)'
            cand delete 'Delete an identity (Identity/set)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;identity;help;get'= {
        }
        &'himalaya;jmap;identity;help;create'= {
        }
        &'himalaya;jmap;identity;help;update'= {
        }
        &'himalaya;jmap;identity;help;delete'= {
        }
        &'himalaya;jmap;identity;help;help'= {
        }
        &'himalaya;jmap;submission'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Fetch submissions by ID (EmailSubmission/get)'
            cand query 'Query and list submissions (EmailSubmission/query + EmailSubmission/get)'
            cand create 'Submit a draft email for sending (EmailSubmission/set)'
            cand cancel 'Cancel a pending submission (EmailSubmission/set)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;submission;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;submission;query'= {
            cand --undo-status 'Filter by undo status (`pending`, `final`, `canceled`)'
            cand --before 'Filter by sent-before date (RFC 3339)'
            cand --after 'Filter by sent-after date (RFC 3339)'
            cand -s 'Number of submissions to display per page'
            cand --page-size 'Number of submissions to display per page'
            cand -p 'Page index, starting from 1'
            cand --page 'Page index, starting from 1'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;submission;create'= {
            cand --identity-id 'The identity ID to send as (from `identity get`)'
            cand --mail-from 'Override the MAIL FROM address (uses `From` header if omitted)'
            cand --rcpt-to 'Override the RCPT TO addresses (uses `To`, `Cc`, `Bcc` if omitted)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;submission;cancel'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;submission;help'= {
            cand get 'Fetch submissions by ID (EmailSubmission/get)'
            cand query 'Query and list submissions (EmailSubmission/query + EmailSubmission/get)'
            cand create 'Submit a draft email for sending (EmailSubmission/set)'
            cand cancel 'Cancel a pending submission (EmailSubmission/set)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;submission;help;get'= {
        }
        &'himalaya;jmap;submission;help;query'= {
        }
        &'himalaya;jmap;submission;help;create'= {
        }
        &'himalaya;jmap;submission;help;cancel'= {
        }
        &'himalaya;jmap;submission;help;help'= {
        }
        &'himalaya;jmap;vacation-response'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the vacation response (VacationResponse/get)'
            cand set 'Update the vacation response (VacationResponse/set)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;vacation'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the vacation response (VacationResponse/get)'
            cand set 'Update the vacation response (VacationResponse/set)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;vacation-response;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;vacation;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;vacation-response;set'= {
            cand --from-date 'Active from date (RFC 3339)'
            cand --to-date 'Active until date (RFC 3339)'
            cand --subject 'Subject line for the auto-reply'
            cand --text-body 'Plaintext body for the auto-reply'
            cand --html-body 'HTML body for the auto-reply'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Enable the vacation response'
            cand --disable 'Disable the vacation response'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;vacation;set'= {
            cand --from-date 'Active from date (RFC 3339)'
            cand --to-date 'Active until date (RFC 3339)'
            cand --subject 'Subject line for the auto-reply'
            cand --text-body 'Plaintext body for the auto-reply'
            cand --html-body 'HTML body for the auto-reply'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Enable the vacation response'
            cand --disable 'Disable the vacation response'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;jmap;vacation-response;help'= {
            cand get 'Get the vacation response (VacationResponse/get)'
            cand set 'Update the vacation response (VacationResponse/set)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;vacation-response;help;get'= {
        }
        &'himalaya;jmap;vacation-response;help;set'= {
        }
        &'himalaya;jmap;vacation-response;help;help'= {
        }
        &'himalaya;jmap;vacation;help'= {
            cand get 'Get the vacation response (VacationResponse/get)'
            cand set 'Update the vacation response (VacationResponse/set)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;vacation;help;get'= {
        }
        &'himalaya;jmap;vacation;help;set'= {
        }
        &'himalaya;jmap;vacation;help;help'= {
        }
        &'himalaya;jmap;help'= {
            cand query 'Send a raw JMAP method-calls array and print the response'
            cand mailbox 'Manage JMAP mailboxes'
            cand email 'Manage JMAP emails'
            cand thread 'Manage JMAP threads'
            cand identity 'Manage JMAP sender identities'
            cand submission 'Manage JMAP email submissions'
            cand vacation-response 'Manage JMAP vacation response'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;jmap;help;query'= {
        }
        &'himalaya;jmap;help;mailbox'= {
            cand get 'Get JMAP mailboxes by ID (Mailbox/get)'
            cand query 'Query JMAP mailboxes (Mailbox/query + Mailbox/get)'
            cand create 'Create a JMAP mailbox'
            cand update 'Update a JMAP mailbox'
            cand destroy 'Delete a JMAP mailbox'
        }
        &'himalaya;jmap;help;mailbox;get'= {
        }
        &'himalaya;jmap;help;mailbox;query'= {
        }
        &'himalaya;jmap;help;mailbox;create'= {
        }
        &'himalaya;jmap;help;mailbox;update'= {
        }
        &'himalaya;jmap;help;mailbox;destroy'= {
        }
        &'himalaya;jmap;help;email'= {
            cand get 'Get JMAP emails by ID (Email/get)'
            cand query 'Query JMAP emails (Email/query + Email/get)'
            cand read 'Read the content of a JMAP email (Email/get with body)'
            cand update 'Update JMAP emails via patch operations (Email/set)'
            cand delete 'Delete JMAP emails (Email/set destroy)'
            cand copy 'Copy JMAP emails from another account (Email/copy)'
            cand export 'Export a raw RFC 5322 message to stdout (Email/get + blob download)'
            cand import 'Import an RFC 5322 message into a mailbox (upload + Email/import)'
            cand parse 'Parse RFC 5322 message blobs without storing them (Email/parse)'
        }
        &'himalaya;jmap;help;email;get'= {
        }
        &'himalaya;jmap;help;email;query'= {
        }
        &'himalaya;jmap;help;email;read'= {
        }
        &'himalaya;jmap;help;email;update'= {
        }
        &'himalaya;jmap;help;email;delete'= {
        }
        &'himalaya;jmap;help;email;copy'= {
        }
        &'himalaya;jmap;help;email;export'= {
        }
        &'himalaya;jmap;help;email;import'= {
        }
        &'himalaya;jmap;help;email;parse'= {
        }
        &'himalaya;jmap;help;thread'= {
            cand get 'Fetch threads by ID (Thread/get)'
        }
        &'himalaya;jmap;help;thread;get'= {
        }
        &'himalaya;jmap;help;identity'= {
            cand get 'Fetch identities (Identity/get)'
            cand create 'Create a new identity (Identity/set)'
            cand update 'Update an existing identity (Identity/set)'
            cand delete 'Delete an identity (Identity/set)'
        }
        &'himalaya;jmap;help;identity;get'= {
        }
        &'himalaya;jmap;help;identity;create'= {
        }
        &'himalaya;jmap;help;identity;update'= {
        }
        &'himalaya;jmap;help;identity;delete'= {
        }
        &'himalaya;jmap;help;submission'= {
            cand get 'Fetch submissions by ID (EmailSubmission/get)'
            cand query 'Query and list submissions (EmailSubmission/query + EmailSubmission/get)'
            cand create 'Submit a draft email for sending (EmailSubmission/set)'
            cand cancel 'Cancel a pending submission (EmailSubmission/set)'
        }
        &'himalaya;jmap;help;submission;get'= {
        }
        &'himalaya;jmap;help;submission;query'= {
        }
        &'himalaya;jmap;help;submission;create'= {
        }
        &'himalaya;jmap;help;submission;cancel'= {
        }
        &'himalaya;jmap;help;vacation-response'= {
            cand get 'Get the vacation response (VacationResponse/get)'
            cand set 'Update the vacation response (VacationResponse/set)'
        }
        &'himalaya;jmap;help;vacation-response;get'= {
        }
        &'himalaya;jmap;help;vacation-response;set'= {
        }
        &'himalaya;jmap;help;help'= {
        }
        &'himalaya;gmail'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand profile 'Manage the Gmail user profile (users.getProfile)'
            cand labels 'Manage Gmail labels (users.labels)'
            cand label 'Manage Gmail labels (users.labels)'
            cand messages 'Manage Gmail messages (users.messages)'
            cand message 'Manage Gmail messages (users.messages)'
            cand msg 'Manage Gmail messages (users.messages)'
            cand attachments 'Manage Gmail message attachments (messages.attachments)'
            cand attachment 'Manage Gmail message attachments (messages.attachments)'
            cand drafts 'Manage Gmail drafts (users.drafts)'
            cand draft 'Manage Gmail drafts (users.drafts)'
            cand threads 'Manage Gmail threads (users.threads)'
            cand thread 'Manage Gmail threads (users.threads)'
            cand history 'Manage the Gmail mailbox history (users.history)'
            cand settings 'Manage Gmail settings (users.settings), organized by sub-resource'
            cand setting 'Manage Gmail settings (users.settings), organized by sub-resource'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;profile'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail profile: email address, message/thread totals and the current history id'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;profile;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;profile;help'= {
            cand get 'Get the Gmail profile: email address, message/thread totals and the current history id'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;profile;help;get'= {
        }
        &'himalaya;gmail;profile;help;help'= {
        }
        &'himalaya;gmail;labels'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail labels (users.labels.list)'
            cand get 'Get one or more Gmail labels by identifier (users.labels.get)'
            cand create 'Create a Gmail label (users.labels.create)'
            cand update 'Update a Gmail label name (users.labels.update)'
            cand delete 'Delete a Gmail label (users.labels.delete)'
            cand del 'Delete a Gmail label (users.labels.delete)'
            cand remove 'Delete a Gmail label (users.labels.delete)'
            cand rm 'Delete a Gmail label (users.labels.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;label'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail labels (users.labels.list)'
            cand get 'Get one or more Gmail labels by identifier (users.labels.get)'
            cand create 'Create a Gmail label (users.labels.create)'
            cand update 'Update a Gmail label name (users.labels.update)'
            cand delete 'Delete a Gmail label (users.labels.delete)'
            cand del 'Delete a Gmail label (users.labels.delete)'
            cand remove 'Delete a Gmail label (users.labels.delete)'
            cand rm 'Delete a Gmail label (users.labels.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;labels;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;label;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;labels;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;label;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;labels;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;label;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;labels;update'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;label;update'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;labels;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;labels;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;labels;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;labels;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;label;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;label;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;label;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;label;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;labels;help'= {
            cand list 'List all Gmail labels (users.labels.list)'
            cand get 'Get one or more Gmail labels by identifier (users.labels.get)'
            cand create 'Create a Gmail label (users.labels.create)'
            cand update 'Update a Gmail label name (users.labels.update)'
            cand delete 'Delete a Gmail label (users.labels.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;labels;help;list'= {
        }
        &'himalaya;gmail;labels;help;get'= {
        }
        &'himalaya;gmail;labels;help;create'= {
        }
        &'himalaya;gmail;labels;help;update'= {
        }
        &'himalaya;gmail;labels;help;delete'= {
        }
        &'himalaya;gmail;labels;help;help'= {
        }
        &'himalaya;gmail;label;help'= {
            cand list 'List all Gmail labels (users.labels.list)'
            cand get 'Get one or more Gmail labels by identifier (users.labels.get)'
            cand create 'Create a Gmail label (users.labels.create)'
            cand update 'Update a Gmail label name (users.labels.update)'
            cand delete 'Delete a Gmail label (users.labels.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;label;help;list'= {
        }
        &'himalaya;gmail;label;help;get'= {
        }
        &'himalaya;gmail;label;help;create'= {
        }
        &'himalaya;gmail;label;help;update'= {
        }
        &'himalaya;gmail;label;help;delete'= {
        }
        &'himalaya;gmail;label;help;help'= {
        }
        &'himalaya;gmail;messages'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Gmail message ids matching the given query and labels (users.messages.list)'
            cand get 'Get a single Gmail message (users.messages.get)'
            cand send 'Send a Gmail message (users.messages.send)'
            cand import 'Import a Gmail message into the mailbox (users.messages.import)'
            cand insert 'Insert a Gmail message into the mailbox without sending (users.messages.insert)'
            cand modify 'Modify the labels of a Gmail message (users.messages.modify)'
            cand trash 'Move a Gmail message to the trash (users.messages.trash)'
            cand untrash 'Remove a Gmail message from the trash (users.messages.untrash)'
            cand delete 'Permanently delete a Gmail message (users.messages.delete)'
            cand del 'Permanently delete a Gmail message (users.messages.delete)'
            cand remove 'Permanently delete a Gmail message (users.messages.delete)'
            cand rm 'Permanently delete a Gmail message (users.messages.delete)'
            cand batch-modify 'Modify the labels of several Gmail messages at once (users.messages.batchModify)'
            cand batch-delete 'Permanently delete several Gmail messages at once (users.messages.batchDelete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;message'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Gmail message ids matching the given query and labels (users.messages.list)'
            cand get 'Get a single Gmail message (users.messages.get)'
            cand send 'Send a Gmail message (users.messages.send)'
            cand import 'Import a Gmail message into the mailbox (users.messages.import)'
            cand insert 'Insert a Gmail message into the mailbox without sending (users.messages.insert)'
            cand modify 'Modify the labels of a Gmail message (users.messages.modify)'
            cand trash 'Move a Gmail message to the trash (users.messages.trash)'
            cand untrash 'Remove a Gmail message from the trash (users.messages.untrash)'
            cand delete 'Permanently delete a Gmail message (users.messages.delete)'
            cand del 'Permanently delete a Gmail message (users.messages.delete)'
            cand remove 'Permanently delete a Gmail message (users.messages.delete)'
            cand rm 'Permanently delete a Gmail message (users.messages.delete)'
            cand batch-modify 'Modify the labels of several Gmail messages at once (users.messages.batchModify)'
            cand batch-delete 'Permanently delete several Gmail messages at once (users.messages.batchDelete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;msg'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Gmail message ids matching the given query and labels (users.messages.list)'
            cand get 'Get a single Gmail message (users.messages.get)'
            cand send 'Send a Gmail message (users.messages.send)'
            cand import 'Import a Gmail message into the mailbox (users.messages.import)'
            cand insert 'Insert a Gmail message into the mailbox without sending (users.messages.insert)'
            cand modify 'Modify the labels of a Gmail message (users.messages.modify)'
            cand trash 'Move a Gmail message to the trash (users.messages.trash)'
            cand untrash 'Remove a Gmail message from the trash (users.messages.untrash)'
            cand delete 'Permanently delete a Gmail message (users.messages.delete)'
            cand del 'Permanently delete a Gmail message (users.messages.delete)'
            cand remove 'Permanently delete a Gmail message (users.messages.delete)'
            cand rm 'Permanently delete a Gmail message (users.messages.delete)'
            cand batch-modify 'Modify the labels of several Gmail messages at once (users.messages.batchModify)'
            cand batch-delete 'Permanently delete several Gmail messages at once (users.messages.batchDelete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;messages;list'= {
            cand -q 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand --query 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand -l 'Only return messages carrying the given label id. Can be repeated to require multiple labels'
            cand --label 'Only return messages carrying the given label id. Can be repeated to require multiple labels'
            cand -s 'Maximum number of message ids to return'
            cand --max-results 'Maximum number of message ids to return'
            cand --page-token 'Page token returned by a previous listing, to fetch the next page'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --include-spam-trash 'Also include messages from SPAM and TRASH'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;list'= {
            cand -q 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand --query 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand -l 'Only return messages carrying the given label id. Can be repeated to require multiple labels'
            cand --label 'Only return messages carrying the given label id. Can be repeated to require multiple labels'
            cand -s 'Maximum number of message ids to return'
            cand --max-results 'Maximum number of message ids to return'
            cand --page-token 'Page token returned by a previous listing, to fetch the next page'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --include-spam-trash 'Also include messages from SPAM and TRASH'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;list'= {
            cand -q 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand --query 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand -l 'Only return messages carrying the given label id. Can be repeated to require multiple labels'
            cand --label 'Only return messages carrying the given label id. Can be repeated to require multiple labels'
            cand -s 'Maximum number of message ids to return'
            cand --max-results 'Maximum number of message ids to return'
            cand --page-token 'Page token returned by a previous listing, to fetch the next page'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --include-spam-trash 'Also include messages from SPAM and TRASH'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;get'= {
            cand --format 'The amount of message detail to return'
            cand --header 'Only render the given header. Can be repeated, and matched case-insensitively'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;get'= {
            cand --format 'The amount of message detail to return'
            cand --header 'Only render the given header. Can be repeated, and matched case-insensitively'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;get'= {
            cand --format 'The amount of message detail to return'
            cand --header 'Only render the given header. Can be repeated, and matched case-insensitively'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;send'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;send'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;send'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;import'= {
            cand --label 'Label id to apply to the imported message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;import'= {
            cand --label 'Label id to apply to the imported message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;import'= {
            cand --label 'Label id to apply to the imported message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;insert'= {
            cand --label 'Label id to apply to the inserted message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;insert'= {
            cand --label 'Label id to apply to the inserted message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;insert'= {
            cand --label 'Label id to apply to the inserted message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;modify'= {
            cand --add-label 'Label id to add to the message. Can be repeated'
            cand --remove-label 'Label id to remove from the message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;modify'= {
            cand --add-label 'Label id to add to the message. Can be repeated'
            cand --remove-label 'Label id to remove from the message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;modify'= {
            cand --add-label 'Label id to add to the message. Can be repeated'
            cand --remove-label 'Label id to remove from the message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;trash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;trash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;trash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;untrash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;untrash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;untrash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;batch-modify'= {
            cand --add-label 'Label id to add to every message. Can be repeated'
            cand --remove-label 'Label id to remove from every message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;batch-modify'= {
            cand --add-label 'Label id to add to every message. Can be repeated'
            cand --remove-label 'Label id to remove from every message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;batch-modify'= {
            cand --add-label 'Label id to add to every message. Can be repeated'
            cand --remove-label 'Label id to remove from every message. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;batch-delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;message;batch-delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;msg;batch-delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;messages;help'= {
            cand list 'List Gmail message ids matching the given query and labels (users.messages.list)'
            cand get 'Get a single Gmail message (users.messages.get)'
            cand send 'Send a Gmail message (users.messages.send)'
            cand import 'Import a Gmail message into the mailbox (users.messages.import)'
            cand insert 'Insert a Gmail message into the mailbox without sending (users.messages.insert)'
            cand modify 'Modify the labels of a Gmail message (users.messages.modify)'
            cand trash 'Move a Gmail message to the trash (users.messages.trash)'
            cand untrash 'Remove a Gmail message from the trash (users.messages.untrash)'
            cand delete 'Permanently delete a Gmail message (users.messages.delete)'
            cand batch-modify 'Modify the labels of several Gmail messages at once (users.messages.batchModify)'
            cand batch-delete 'Permanently delete several Gmail messages at once (users.messages.batchDelete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;messages;help;list'= {
        }
        &'himalaya;gmail;messages;help;get'= {
        }
        &'himalaya;gmail;messages;help;send'= {
        }
        &'himalaya;gmail;messages;help;import'= {
        }
        &'himalaya;gmail;messages;help;insert'= {
        }
        &'himalaya;gmail;messages;help;modify'= {
        }
        &'himalaya;gmail;messages;help;trash'= {
        }
        &'himalaya;gmail;messages;help;untrash'= {
        }
        &'himalaya;gmail;messages;help;delete'= {
        }
        &'himalaya;gmail;messages;help;batch-modify'= {
        }
        &'himalaya;gmail;messages;help;batch-delete'= {
        }
        &'himalaya;gmail;messages;help;help'= {
        }
        &'himalaya;gmail;message;help'= {
            cand list 'List Gmail message ids matching the given query and labels (users.messages.list)'
            cand get 'Get a single Gmail message (users.messages.get)'
            cand send 'Send a Gmail message (users.messages.send)'
            cand import 'Import a Gmail message into the mailbox (users.messages.import)'
            cand insert 'Insert a Gmail message into the mailbox without sending (users.messages.insert)'
            cand modify 'Modify the labels of a Gmail message (users.messages.modify)'
            cand trash 'Move a Gmail message to the trash (users.messages.trash)'
            cand untrash 'Remove a Gmail message from the trash (users.messages.untrash)'
            cand delete 'Permanently delete a Gmail message (users.messages.delete)'
            cand batch-modify 'Modify the labels of several Gmail messages at once (users.messages.batchModify)'
            cand batch-delete 'Permanently delete several Gmail messages at once (users.messages.batchDelete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;message;help;list'= {
        }
        &'himalaya;gmail;message;help;get'= {
        }
        &'himalaya;gmail;message;help;send'= {
        }
        &'himalaya;gmail;message;help;import'= {
        }
        &'himalaya;gmail;message;help;insert'= {
        }
        &'himalaya;gmail;message;help;modify'= {
        }
        &'himalaya;gmail;message;help;trash'= {
        }
        &'himalaya;gmail;message;help;untrash'= {
        }
        &'himalaya;gmail;message;help;delete'= {
        }
        &'himalaya;gmail;message;help;batch-modify'= {
        }
        &'himalaya;gmail;message;help;batch-delete'= {
        }
        &'himalaya;gmail;message;help;help'= {
        }
        &'himalaya;gmail;msg;help'= {
            cand list 'List Gmail message ids matching the given query and labels (users.messages.list)'
            cand get 'Get a single Gmail message (users.messages.get)'
            cand send 'Send a Gmail message (users.messages.send)'
            cand import 'Import a Gmail message into the mailbox (users.messages.import)'
            cand insert 'Insert a Gmail message into the mailbox without sending (users.messages.insert)'
            cand modify 'Modify the labels of a Gmail message (users.messages.modify)'
            cand trash 'Move a Gmail message to the trash (users.messages.trash)'
            cand untrash 'Remove a Gmail message from the trash (users.messages.untrash)'
            cand delete 'Permanently delete a Gmail message (users.messages.delete)'
            cand batch-modify 'Modify the labels of several Gmail messages at once (users.messages.batchModify)'
            cand batch-delete 'Permanently delete several Gmail messages at once (users.messages.batchDelete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;msg;help;list'= {
        }
        &'himalaya;gmail;msg;help;get'= {
        }
        &'himalaya;gmail;msg;help;send'= {
        }
        &'himalaya;gmail;msg;help;import'= {
        }
        &'himalaya;gmail;msg;help;insert'= {
        }
        &'himalaya;gmail;msg;help;modify'= {
        }
        &'himalaya;gmail;msg;help;trash'= {
        }
        &'himalaya;gmail;msg;help;untrash'= {
        }
        &'himalaya;gmail;msg;help;delete'= {
        }
        &'himalaya;gmail;msg;help;batch-modify'= {
        }
        &'himalaya;gmail;msg;help;batch-delete'= {
        }
        &'himalaya;gmail;msg;help;help'= {
        }
        &'himalaya;gmail;attachments'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get a Gmail attachment by message and attachment id, then print or save its decoded bytes'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;attachment'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get a Gmail attachment by message and attachment id, then print or save its decoded bytes'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;attachments;get'= {
            cand -o 'Save the decoded bytes to this path instead of printing them'
            cand --output 'Save the decoded bytes to this path instead of printing them'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;attachment;get'= {
            cand -o 'Save the decoded bytes to this path instead of printing them'
            cand --output 'Save the decoded bytes to this path instead of printing them'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;attachments;help'= {
            cand get 'Get a Gmail attachment by message and attachment id, then print or save its decoded bytes'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;attachments;help;get'= {
        }
        &'himalaya;gmail;attachments;help;help'= {
        }
        &'himalaya;gmail;attachment;help'= {
            cand get 'Get a Gmail attachment by message and attachment id, then print or save its decoded bytes'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;attachment;help;get'= {
        }
        &'himalaya;gmail;attachment;help;help'= {
        }
        &'himalaya;gmail;drafts'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Gmail drafts (users.drafts.list)'
            cand get 'Get a single Gmail draft (users.drafts.get)'
            cand create 'Create a Gmail draft (users.drafts.create)'
            cand update 'Update a Gmail draft (users.drafts.update)'
            cand send 'Send a Gmail draft (users.drafts.send)'
            cand delete 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand del 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand remove 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand rm 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;draft'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Gmail drafts (users.drafts.list)'
            cand get 'Get a single Gmail draft (users.drafts.get)'
            cand create 'Create a Gmail draft (users.drafts.create)'
            cand update 'Update a Gmail draft (users.drafts.update)'
            cand send 'Send a Gmail draft (users.drafts.send)'
            cand delete 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand del 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand remove 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand rm 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;drafts;list'= {
            cand -q 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand --query 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand -s 'Maximum number of drafts to return'
            cand --max-results 'Maximum number of drafts to return'
            cand --page-token 'Page token returned by a previous listing, to fetch the next page'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --include-spam-trash 'Also include drafts from SPAM and TRASH'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;list'= {
            cand -q 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand --query 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand -s 'Maximum number of drafts to return'
            cand --max-results 'Maximum number of drafts to return'
            cand --page-token 'Page token returned by a previous listing, to fetch the next page'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --include-spam-trash 'Also include drafts from SPAM and TRASH'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;get'= {
            cand --format 'The amount of message detail to return'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;get'= {
            cand --format 'The amount of message detail to return'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;create'= {
            cand --thread-id 'Thread id to attach the draft to'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;create'= {
            cand --thread-id 'Thread id to attach the draft to'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;update'= {
            cand --thread-id 'Thread id to attach the draft to'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;update'= {
            cand --thread-id 'Thread id to attach the draft to'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;send'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;send'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;draft;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;drafts;help'= {
            cand list 'List Gmail drafts (users.drafts.list)'
            cand get 'Get a single Gmail draft (users.drafts.get)'
            cand create 'Create a Gmail draft (users.drafts.create)'
            cand update 'Update a Gmail draft (users.drafts.update)'
            cand send 'Send a Gmail draft (users.drafts.send)'
            cand delete 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;drafts;help;list'= {
        }
        &'himalaya;gmail;drafts;help;get'= {
        }
        &'himalaya;gmail;drafts;help;create'= {
        }
        &'himalaya;gmail;drafts;help;update'= {
        }
        &'himalaya;gmail;drafts;help;send'= {
        }
        &'himalaya;gmail;drafts;help;delete'= {
        }
        &'himalaya;gmail;drafts;help;help'= {
        }
        &'himalaya;gmail;draft;help'= {
            cand list 'List Gmail drafts (users.drafts.list)'
            cand get 'Get a single Gmail draft (users.drafts.get)'
            cand create 'Create a Gmail draft (users.drafts.create)'
            cand update 'Update a Gmail draft (users.drafts.update)'
            cand send 'Send a Gmail draft (users.drafts.send)'
            cand delete 'Permanently delete a Gmail draft (users.drafts.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;draft;help;list'= {
        }
        &'himalaya;gmail;draft;help;get'= {
        }
        &'himalaya;gmail;draft;help;create'= {
        }
        &'himalaya;gmail;draft;help;update'= {
        }
        &'himalaya;gmail;draft;help;send'= {
        }
        &'himalaya;gmail;draft;help;delete'= {
        }
        &'himalaya;gmail;draft;help;help'= {
        }
        &'himalaya;gmail;threads'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Gmail threads matching the given query and labels (users.threads.list)'
            cand get 'Get a single Gmail thread with all its messages (users.threads.get)'
            cand modify 'Modify the labels of every message in a Gmail thread (users.threads.modify)'
            cand trash 'Move a Gmail thread to the trash (users.threads.trash)'
            cand untrash 'Remove a Gmail thread from the trash (users.threads.untrash)'
            cand delete 'Permanently delete a Gmail thread (users.threads.delete)'
            cand del 'Permanently delete a Gmail thread (users.threads.delete)'
            cand remove 'Permanently delete a Gmail thread (users.threads.delete)'
            cand rm 'Permanently delete a Gmail thread (users.threads.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;thread'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Gmail threads matching the given query and labels (users.threads.list)'
            cand get 'Get a single Gmail thread with all its messages (users.threads.get)'
            cand modify 'Modify the labels of every message in a Gmail thread (users.threads.modify)'
            cand trash 'Move a Gmail thread to the trash (users.threads.trash)'
            cand untrash 'Remove a Gmail thread from the trash (users.threads.untrash)'
            cand delete 'Permanently delete a Gmail thread (users.threads.delete)'
            cand del 'Permanently delete a Gmail thread (users.threads.delete)'
            cand remove 'Permanently delete a Gmail thread (users.threads.delete)'
            cand rm 'Permanently delete a Gmail thread (users.threads.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;threads;list'= {
            cand -q 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand --query 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand -l 'Only return threads carrying the given label id. Can be repeated to require multiple labels'
            cand --label 'Only return threads carrying the given label id. Can be repeated to require multiple labels'
            cand -s 'Maximum number of threads to return'
            cand --max-results 'Maximum number of threads to return'
            cand --page-token 'Page token returned by a previous listing, to fetch the next page'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --include-spam-trash 'Also include threads from SPAM and TRASH'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;list'= {
            cand -q 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand --query 'Gmail search query, using the same syntax as the Gmail search box (e.g. `from:alice is:unread`)'
            cand -l 'Only return threads carrying the given label id. Can be repeated to require multiple labels'
            cand --label 'Only return threads carrying the given label id. Can be repeated to require multiple labels'
            cand -s 'Maximum number of threads to return'
            cand --max-results 'Maximum number of threads to return'
            cand --page-token 'Page token returned by a previous listing, to fetch the next page'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --include-spam-trash 'Also include threads from SPAM and TRASH'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;get'= {
            cand --format 'The amount of message detail to return'
            cand --header 'Only render the given header. Can be repeated, and matched case-insensitively'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;get'= {
            cand --format 'The amount of message detail to return'
            cand --header 'Only render the given header. Can be repeated, and matched case-insensitively'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;modify'= {
            cand --add-label 'Label id to add to the thread. Can be repeated'
            cand --remove-label 'Label id to remove from the thread. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;modify'= {
            cand --add-label 'Label id to add to the thread. Can be repeated'
            cand --remove-label 'Label id to remove from the thread. Can be repeated'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;trash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;trash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;untrash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;untrash'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;thread;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;threads;help'= {
            cand list 'List Gmail threads matching the given query and labels (users.threads.list)'
            cand get 'Get a single Gmail thread with all its messages (users.threads.get)'
            cand modify 'Modify the labels of every message in a Gmail thread (users.threads.modify)'
            cand trash 'Move a Gmail thread to the trash (users.threads.trash)'
            cand untrash 'Remove a Gmail thread from the trash (users.threads.untrash)'
            cand delete 'Permanently delete a Gmail thread (users.threads.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;threads;help;list'= {
        }
        &'himalaya;gmail;threads;help;get'= {
        }
        &'himalaya;gmail;threads;help;modify'= {
        }
        &'himalaya;gmail;threads;help;trash'= {
        }
        &'himalaya;gmail;threads;help;untrash'= {
        }
        &'himalaya;gmail;threads;help;delete'= {
        }
        &'himalaya;gmail;threads;help;help'= {
        }
        &'himalaya;gmail;thread;help'= {
            cand list 'List Gmail threads matching the given query and labels (users.threads.list)'
            cand get 'Get a single Gmail thread with all its messages (users.threads.get)'
            cand modify 'Modify the labels of every message in a Gmail thread (users.threads.modify)'
            cand trash 'Move a Gmail thread to the trash (users.threads.trash)'
            cand untrash 'Remove a Gmail thread from the trash (users.threads.untrash)'
            cand delete 'Permanently delete a Gmail thread (users.threads.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;thread;help;list'= {
        }
        &'himalaya;gmail;thread;help;get'= {
        }
        &'himalaya;gmail;thread;help;modify'= {
        }
        &'himalaya;gmail;thread;help;trash'= {
        }
        &'himalaya;gmail;thread;help;untrash'= {
        }
        &'himalaya;gmail;thread;help;delete'= {
        }
        &'himalaya;gmail;thread;help;help'= {
        }
        &'himalaya;gmail;history'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List the changes applied to the mailbox since a given history id'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;history;list'= {
            cand --start-history-id 'History id to start listing changes from'
            cand --label-id 'Restrict the listing to changes affecting this label id'
            cand --history-type 'History change types to include (repeatable)'
            cand -s 'Maximum number of history records to return'
            cand --max-results 'Maximum number of history records to return'
            cand --page-token 'Page token from a previous listing, for pagination'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;history;help'= {
            cand list 'List the changes applied to the mailbox since a given history id'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;history;help;list'= {
        }
        &'himalaya;gmail;history;help;help'= {
        }
        &'himalaya;gmail;settings'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand vacation 'Manage the Gmail vacation responder settings (users.settings.getVacation / updateVacation)'
            cand imap 'Manage the Gmail IMAP access settings (users.settings.getImap / updateImap)'
            cand pop 'Manage the Gmail POP access settings (users.settings.getPop / updatePop)'
            cand language 'Manage the Gmail display language settings (users.settings.getLanguage / updateLanguage)'
            cand auto-forwarding 'Manage the Gmail auto-forwarding settings (users.settings.getAutoForwarding / updateAutoForwarding)'
            cand autoforwarding 'Manage the Gmail auto-forwarding settings (users.settings.getAutoForwarding / updateAutoForwarding)'
            cand filters 'Manage Gmail filters (users.settings.filters)'
            cand filter 'Manage Gmail filters (users.settings.filters)'
            cand forwarding-addresses 'Manage Gmail forwarding addresses (users.settings.forwardingAddresses)'
            cand forwarding-address 'Manage Gmail forwarding addresses (users.settings.forwardingAddresses)'
            cand delegates 'Manage Gmail delegates (users.settings.delegates)'
            cand delegate 'Manage Gmail delegates (users.settings.delegates)'
            cand send-as 'Manage Gmail send-as aliases (settings.sendAs)'
            cand sendas 'Manage Gmail send-as aliases (settings.sendAs)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand vacation 'Manage the Gmail vacation responder settings (users.settings.getVacation / updateVacation)'
            cand imap 'Manage the Gmail IMAP access settings (users.settings.getImap / updateImap)'
            cand pop 'Manage the Gmail POP access settings (users.settings.getPop / updatePop)'
            cand language 'Manage the Gmail display language settings (users.settings.getLanguage / updateLanguage)'
            cand auto-forwarding 'Manage the Gmail auto-forwarding settings (users.settings.getAutoForwarding / updateAutoForwarding)'
            cand autoforwarding 'Manage the Gmail auto-forwarding settings (users.settings.getAutoForwarding / updateAutoForwarding)'
            cand filters 'Manage Gmail filters (users.settings.filters)'
            cand filter 'Manage Gmail filters (users.settings.filters)'
            cand forwarding-addresses 'Manage Gmail forwarding addresses (users.settings.forwardingAddresses)'
            cand forwarding-address 'Manage Gmail forwarding addresses (users.settings.forwardingAddresses)'
            cand delegates 'Manage Gmail delegates (users.settings.delegates)'
            cand delegate 'Manage Gmail delegates (users.settings.delegates)'
            cand send-as 'Manage Gmail send-as aliases (settings.sendAs)'
            cand sendas 'Manage Gmail send-as aliases (settings.sendAs)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;vacation'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail vacation responder settings'
            cand set 'Update the Gmail vacation responder settings'
            cand update 'Update the Gmail vacation responder settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;vacation;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;vacation;set'= {
            cand --subject 'Subject of the auto-reply message'
            cand --body 'Plain-text body of the auto-reply message'
            cand --html 'HTML body of the auto-reply message'
            cand --restrict-to-contacts 'Send the auto-reply only to people in your contacts'
            cand --restrict-to-domain 'Send the auto-reply only to people in your domain'
            cand --start-time 'First day the responder is active; Gmail expects epoch milliseconds'
            cand --end-time 'Last day the responder is active; Gmail expects epoch milliseconds'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn the responder on'
            cand --disable 'Turn the responder off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;vacation;update'= {
            cand --subject 'Subject of the auto-reply message'
            cand --body 'Plain-text body of the auto-reply message'
            cand --html 'HTML body of the auto-reply message'
            cand --restrict-to-contacts 'Send the auto-reply only to people in your contacts'
            cand --restrict-to-domain 'Send the auto-reply only to people in your domain'
            cand --start-time 'First day the responder is active; Gmail expects epoch milliseconds'
            cand --end-time 'Last day the responder is active; Gmail expects epoch milliseconds'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn the responder on'
            cand --disable 'Turn the responder off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;vacation;help'= {
            cand get 'Get the Gmail vacation responder settings'
            cand set 'Update the Gmail vacation responder settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;vacation;help;get'= {
        }
        &'himalaya;gmail;settings;vacation;help;set'= {
        }
        &'himalaya;gmail;settings;vacation;help;help'= {
        }
        &'himalaya;gmail;setting;vacation'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail vacation responder settings'
            cand set 'Update the Gmail vacation responder settings'
            cand update 'Update the Gmail vacation responder settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;vacation;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;vacation;set'= {
            cand --subject 'Subject of the auto-reply message'
            cand --body 'Plain-text body of the auto-reply message'
            cand --html 'HTML body of the auto-reply message'
            cand --restrict-to-contacts 'Send the auto-reply only to people in your contacts'
            cand --restrict-to-domain 'Send the auto-reply only to people in your domain'
            cand --start-time 'First day the responder is active; Gmail expects epoch milliseconds'
            cand --end-time 'Last day the responder is active; Gmail expects epoch milliseconds'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn the responder on'
            cand --disable 'Turn the responder off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;vacation;update'= {
            cand --subject 'Subject of the auto-reply message'
            cand --body 'Plain-text body of the auto-reply message'
            cand --html 'HTML body of the auto-reply message'
            cand --restrict-to-contacts 'Send the auto-reply only to people in your contacts'
            cand --restrict-to-domain 'Send the auto-reply only to people in your domain'
            cand --start-time 'First day the responder is active; Gmail expects epoch milliseconds'
            cand --end-time 'Last day the responder is active; Gmail expects epoch milliseconds'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn the responder on'
            cand --disable 'Turn the responder off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;vacation;help'= {
            cand get 'Get the Gmail vacation responder settings'
            cand set 'Update the Gmail vacation responder settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;vacation;help;get'= {
        }
        &'himalaya;gmail;setting;vacation;help;set'= {
        }
        &'himalaya;gmail;setting;vacation;help;help'= {
        }
        &'himalaya;gmail;settings;imap'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail IMAP access settings'
            cand set 'Update the Gmail IMAP access settings'
            cand update 'Update the Gmail IMAP access settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;imap;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;imap;set'= {
            cand --auto-expunge 'Auto-expunge messages when their last label is removed'
            cand --expunge-behavior 'Action taken on messages marked deleted in IMAP'
            cand --max-folder-size 'Maximum number of messages exposed in an IMAP folder'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn IMAP access on'
            cand --disable 'Turn IMAP access off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;imap;update'= {
            cand --auto-expunge 'Auto-expunge messages when their last label is removed'
            cand --expunge-behavior 'Action taken on messages marked deleted in IMAP'
            cand --max-folder-size 'Maximum number of messages exposed in an IMAP folder'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn IMAP access on'
            cand --disable 'Turn IMAP access off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;imap;help'= {
            cand get 'Get the Gmail IMAP access settings'
            cand set 'Update the Gmail IMAP access settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;imap;help;get'= {
        }
        &'himalaya;gmail;settings;imap;help;set'= {
        }
        &'himalaya;gmail;settings;imap;help;help'= {
        }
        &'himalaya;gmail;setting;imap'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail IMAP access settings'
            cand set 'Update the Gmail IMAP access settings'
            cand update 'Update the Gmail IMAP access settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;imap;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;imap;set'= {
            cand --auto-expunge 'Auto-expunge messages when their last label is removed'
            cand --expunge-behavior 'Action taken on messages marked deleted in IMAP'
            cand --max-folder-size 'Maximum number of messages exposed in an IMAP folder'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn IMAP access on'
            cand --disable 'Turn IMAP access off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;imap;update'= {
            cand --auto-expunge 'Auto-expunge messages when their last label is removed'
            cand --expunge-behavior 'Action taken on messages marked deleted in IMAP'
            cand --max-folder-size 'Maximum number of messages exposed in an IMAP folder'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn IMAP access on'
            cand --disable 'Turn IMAP access off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;imap;help'= {
            cand get 'Get the Gmail IMAP access settings'
            cand set 'Update the Gmail IMAP access settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;imap;help;get'= {
        }
        &'himalaya;gmail;setting;imap;help;set'= {
        }
        &'himalaya;gmail;setting;imap;help;help'= {
        }
        &'himalaya;gmail;settings;pop'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail POP access settings'
            cand set 'Update the Gmail POP access settings'
            cand update 'Update the Gmail POP access settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;pop;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;pop;set'= {
            cand --access-window 'Range of messages made available over POP'
            cand --disposition 'Action taken on messages after they are fetched over POP'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;pop;update'= {
            cand --access-window 'Range of messages made available over POP'
            cand --disposition 'Action taken on messages after they are fetched over POP'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;pop;help'= {
            cand get 'Get the Gmail POP access settings'
            cand set 'Update the Gmail POP access settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;pop;help;get'= {
        }
        &'himalaya;gmail;settings;pop;help;set'= {
        }
        &'himalaya;gmail;settings;pop;help;help'= {
        }
        &'himalaya;gmail;setting;pop'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail POP access settings'
            cand set 'Update the Gmail POP access settings'
            cand update 'Update the Gmail POP access settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;pop;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;pop;set'= {
            cand --access-window 'Range of messages made available over POP'
            cand --disposition 'Action taken on messages after they are fetched over POP'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;pop;update'= {
            cand --access-window 'Range of messages made available over POP'
            cand --disposition 'Action taken on messages after they are fetched over POP'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;pop;help'= {
            cand get 'Get the Gmail POP access settings'
            cand set 'Update the Gmail POP access settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;pop;help;get'= {
        }
        &'himalaya;gmail;setting;pop;help;set'= {
        }
        &'himalaya;gmail;setting;pop;help;help'= {
        }
        &'himalaya;gmail;settings;language'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail display language settings'
            cand set 'Update the Gmail display language settings'
            cand update 'Update the Gmail display language settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;language;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;language;set'= {
            cand --display-language 'Display language tag to set, such as `en` or `fr`'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;language;update'= {
            cand --display-language 'Display language tag to set, such as `en` or `fr`'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;language;help'= {
            cand get 'Get the Gmail display language settings'
            cand set 'Update the Gmail display language settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;language;help;get'= {
        }
        &'himalaya;gmail;settings;language;help;set'= {
        }
        &'himalaya;gmail;settings;language;help;help'= {
        }
        &'himalaya;gmail;setting;language'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail display language settings'
            cand set 'Update the Gmail display language settings'
            cand update 'Update the Gmail display language settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;language;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;language;set'= {
            cand --display-language 'Display language tag to set, such as `en` or `fr`'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;language;update'= {
            cand --display-language 'Display language tag to set, such as `en` or `fr`'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;language;help'= {
            cand get 'Get the Gmail display language settings'
            cand set 'Update the Gmail display language settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;language;help;get'= {
        }
        &'himalaya;gmail;setting;language;help;set'= {
        }
        &'himalaya;gmail;setting;language;help;help'= {
        }
        &'himalaya;gmail;settings;auto-forwarding'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
            cand update 'Update the Gmail auto-forwarding settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;autoforwarding'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
            cand update 'Update the Gmail auto-forwarding settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;auto-forwarding;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;autoforwarding;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;auto-forwarding;set'= {
            cand --email-address 'Address to which incoming messages are forwarded'
            cand --disposition 'Action taken on the original message after it is forwarded'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn auto-forwarding on'
            cand --disable 'Turn auto-forwarding off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;auto-forwarding;update'= {
            cand --email-address 'Address to which incoming messages are forwarded'
            cand --disposition 'Action taken on the original message after it is forwarded'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn auto-forwarding on'
            cand --disable 'Turn auto-forwarding off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;autoforwarding;set'= {
            cand --email-address 'Address to which incoming messages are forwarded'
            cand --disposition 'Action taken on the original message after it is forwarded'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn auto-forwarding on'
            cand --disable 'Turn auto-forwarding off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;autoforwarding;update'= {
            cand --email-address 'Address to which incoming messages are forwarded'
            cand --disposition 'Action taken on the original message after it is forwarded'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn auto-forwarding on'
            cand --disable 'Turn auto-forwarding off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;auto-forwarding;help'= {
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;auto-forwarding;help;get'= {
        }
        &'himalaya;gmail;settings;auto-forwarding;help;set'= {
        }
        &'himalaya;gmail;settings;auto-forwarding;help;help'= {
        }
        &'himalaya;gmail;settings;autoforwarding;help'= {
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;autoforwarding;help;get'= {
        }
        &'himalaya;gmail;settings;autoforwarding;help;set'= {
        }
        &'himalaya;gmail;settings;autoforwarding;help;help'= {
        }
        &'himalaya;gmail;setting;auto-forwarding'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
            cand update 'Update the Gmail auto-forwarding settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;autoforwarding'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
            cand update 'Update the Gmail auto-forwarding settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;auto-forwarding;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;autoforwarding;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;auto-forwarding;set'= {
            cand --email-address 'Address to which incoming messages are forwarded'
            cand --disposition 'Action taken on the original message after it is forwarded'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn auto-forwarding on'
            cand --disable 'Turn auto-forwarding off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;auto-forwarding;update'= {
            cand --email-address 'Address to which incoming messages are forwarded'
            cand --disposition 'Action taken on the original message after it is forwarded'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn auto-forwarding on'
            cand --disable 'Turn auto-forwarding off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;autoforwarding;set'= {
            cand --email-address 'Address to which incoming messages are forwarded'
            cand --disposition 'Action taken on the original message after it is forwarded'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn auto-forwarding on'
            cand --disable 'Turn auto-forwarding off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;autoforwarding;update'= {
            cand --email-address 'Address to which incoming messages are forwarded'
            cand --disposition 'Action taken on the original message after it is forwarded'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --enable 'Turn auto-forwarding on'
            cand --disable 'Turn auto-forwarding off'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;auto-forwarding;help'= {
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;auto-forwarding;help;get'= {
        }
        &'himalaya;gmail;setting;auto-forwarding;help;set'= {
        }
        &'himalaya;gmail;setting;auto-forwarding;help;help'= {
        }
        &'himalaya;gmail;setting;autoforwarding;help'= {
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;autoforwarding;help;get'= {
        }
        &'himalaya;gmail;setting;autoforwarding;help;set'= {
        }
        &'himalaya;gmail;setting;autoforwarding;help;help'= {
        }
        &'himalaya;gmail;settings;filters'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
            cand del 'Delete a Gmail filter (users.settings.filters.delete)'
            cand remove 'Delete a Gmail filter (users.settings.filters.delete)'
            cand rm 'Delete a Gmail filter (users.settings.filters.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;filter'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
            cand del 'Delete a Gmail filter (users.settings.filters.delete)'
            cand remove 'Delete a Gmail filter (users.settings.filters.delete)'
            cand rm 'Delete a Gmail filter (users.settings.filters.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;filters;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filter;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filters;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filter;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filters;create'= {
            cand --from 'Match messages whose sender matches this value'
            cand --to 'Match messages whose recipient matches this value'
            cand --subject 'Match messages whose subject matches this value'
            cand --query 'Match messages with this Gmail search query'
            cand --negated-query 'Exclude messages matching this Gmail search query'
            cand --add-label 'Label identifier to add to matching messages (repeatable)'
            cand --remove-label 'Label identifier to remove from matching messages (repeatable)'
            cand --forward 'Forward matching messages to this address'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --has-attachment 'Match only messages that have an attachment'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filter;create'= {
            cand --from 'Match messages whose sender matches this value'
            cand --to 'Match messages whose recipient matches this value'
            cand --subject 'Match messages whose subject matches this value'
            cand --query 'Match messages with this Gmail search query'
            cand --negated-query 'Exclude messages matching this Gmail search query'
            cand --add-label 'Label identifier to add to matching messages (repeatable)'
            cand --remove-label 'Label identifier to remove from matching messages (repeatable)'
            cand --forward 'Forward matching messages to this address'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --has-attachment 'Match only messages that have an attachment'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filters;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filters;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filters;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filters;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filter;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filter;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filter;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filter;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;filters;help'= {
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;filters;help;list'= {
        }
        &'himalaya;gmail;settings;filters;help;get'= {
        }
        &'himalaya;gmail;settings;filters;help;create'= {
        }
        &'himalaya;gmail;settings;filters;help;delete'= {
        }
        &'himalaya;gmail;settings;filters;help;help'= {
        }
        &'himalaya;gmail;settings;filter;help'= {
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;filter;help;list'= {
        }
        &'himalaya;gmail;settings;filter;help;get'= {
        }
        &'himalaya;gmail;settings;filter;help;create'= {
        }
        &'himalaya;gmail;settings;filter;help;delete'= {
        }
        &'himalaya;gmail;settings;filter;help;help'= {
        }
        &'himalaya;gmail;setting;filters'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
            cand del 'Delete a Gmail filter (users.settings.filters.delete)'
            cand remove 'Delete a Gmail filter (users.settings.filters.delete)'
            cand rm 'Delete a Gmail filter (users.settings.filters.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;filter'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
            cand del 'Delete a Gmail filter (users.settings.filters.delete)'
            cand remove 'Delete a Gmail filter (users.settings.filters.delete)'
            cand rm 'Delete a Gmail filter (users.settings.filters.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;filters;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filter;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filters;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filter;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filters;create'= {
            cand --from 'Match messages whose sender matches this value'
            cand --to 'Match messages whose recipient matches this value'
            cand --subject 'Match messages whose subject matches this value'
            cand --query 'Match messages with this Gmail search query'
            cand --negated-query 'Exclude messages matching this Gmail search query'
            cand --add-label 'Label identifier to add to matching messages (repeatable)'
            cand --remove-label 'Label identifier to remove from matching messages (repeatable)'
            cand --forward 'Forward matching messages to this address'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --has-attachment 'Match only messages that have an attachment'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filter;create'= {
            cand --from 'Match messages whose sender matches this value'
            cand --to 'Match messages whose recipient matches this value'
            cand --subject 'Match messages whose subject matches this value'
            cand --query 'Match messages with this Gmail search query'
            cand --negated-query 'Exclude messages matching this Gmail search query'
            cand --add-label 'Label identifier to add to matching messages (repeatable)'
            cand --remove-label 'Label identifier to remove from matching messages (repeatable)'
            cand --forward 'Forward matching messages to this address'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --has-attachment 'Match only messages that have an attachment'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filters;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filters;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filters;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filters;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filter;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filter;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filter;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filter;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;filters;help'= {
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;filters;help;list'= {
        }
        &'himalaya;gmail;setting;filters;help;get'= {
        }
        &'himalaya;gmail;setting;filters;help;create'= {
        }
        &'himalaya;gmail;setting;filters;help;delete'= {
        }
        &'himalaya;gmail;setting;filters;help;help'= {
        }
        &'himalaya;gmail;setting;filter;help'= {
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;filter;help;list'= {
        }
        &'himalaya;gmail;setting;filter;help;get'= {
        }
        &'himalaya;gmail;setting;filter;help;create'= {
        }
        &'himalaya;gmail;setting;filter;help;delete'= {
        }
        &'himalaya;gmail;setting;filter;help;help'= {
        }
        &'himalaya;gmail;settings;forwarding-addresses'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand del 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand remove 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand rm 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;forwarding-address'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand del 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand remove 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand rm 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;forwarding-addresses;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-address;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-addresses;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-address;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-addresses;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-address;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-addresses;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-addresses;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-addresses;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-addresses;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-address;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-address;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-address;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-address;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;forwarding-addresses;help'= {
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;forwarding-addresses;help;list'= {
        }
        &'himalaya;gmail;settings;forwarding-addresses;help;get'= {
        }
        &'himalaya;gmail;settings;forwarding-addresses;help;create'= {
        }
        &'himalaya;gmail;settings;forwarding-addresses;help;delete'= {
        }
        &'himalaya;gmail;settings;forwarding-addresses;help;help'= {
        }
        &'himalaya;gmail;settings;forwarding-address;help'= {
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;forwarding-address;help;list'= {
        }
        &'himalaya;gmail;settings;forwarding-address;help;get'= {
        }
        &'himalaya;gmail;settings;forwarding-address;help;create'= {
        }
        &'himalaya;gmail;settings;forwarding-address;help;delete'= {
        }
        &'himalaya;gmail;settings;forwarding-address;help;help'= {
        }
        &'himalaya;gmail;setting;forwarding-addresses'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand del 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand remove 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand rm 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;forwarding-address'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand del 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand remove 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand rm 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;forwarding-addresses;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-address;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-addresses;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-address;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-addresses;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-address;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-addresses;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-addresses;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-addresses;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-addresses;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-address;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-address;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-address;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-address;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;forwarding-addresses;help'= {
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;forwarding-addresses;help;list'= {
        }
        &'himalaya;gmail;setting;forwarding-addresses;help;get'= {
        }
        &'himalaya;gmail;setting;forwarding-addresses;help;create'= {
        }
        &'himalaya;gmail;setting;forwarding-addresses;help;delete'= {
        }
        &'himalaya;gmail;setting;forwarding-addresses;help;help'= {
        }
        &'himalaya;gmail;setting;forwarding-address;help'= {
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;forwarding-address;help;list'= {
        }
        &'himalaya;gmail;setting;forwarding-address;help;get'= {
        }
        &'himalaya;gmail;setting;forwarding-address;help;create'= {
        }
        &'himalaya;gmail;setting;forwarding-address;help;delete'= {
        }
        &'himalaya;gmail;setting;forwarding-address;help;help'= {
        }
        &'himalaya;gmail;settings;delegates'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand del 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand remove 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand rm 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;delegate'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand del 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand remove 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand rm 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;delegates;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegate;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegates;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegate;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegates;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegate;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegates;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegates;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegates;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegates;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegate;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegate;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegate;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegate;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;delegates;help'= {
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;delegates;help;list'= {
        }
        &'himalaya;gmail;settings;delegates;help;get'= {
        }
        &'himalaya;gmail;settings;delegates;help;create'= {
        }
        &'himalaya;gmail;settings;delegates;help;delete'= {
        }
        &'himalaya;gmail;settings;delegates;help;help'= {
        }
        &'himalaya;gmail;settings;delegate;help'= {
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;delegate;help;list'= {
        }
        &'himalaya;gmail;settings;delegate;help;get'= {
        }
        &'himalaya;gmail;settings;delegate;help;create'= {
        }
        &'himalaya;gmail;settings;delegate;help;delete'= {
        }
        &'himalaya;gmail;settings;delegate;help;help'= {
        }
        &'himalaya;gmail;setting;delegates'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand del 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand remove 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand rm 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;delegate'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand del 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand remove 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand rm 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;delegates;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegate;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegates;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegate;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegates;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegate;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegates;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegates;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegates;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegates;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegate;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegate;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegate;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegate;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;delegates;help'= {
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;delegates;help;list'= {
        }
        &'himalaya;gmail;setting;delegates;help;get'= {
        }
        &'himalaya;gmail;setting;delegates;help;create'= {
        }
        &'himalaya;gmail;setting;delegates;help;delete'= {
        }
        &'himalaya;gmail;setting;delegates;help;help'= {
        }
        &'himalaya;gmail;setting;delegate;help'= {
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;delegate;help;list'= {
        }
        &'himalaya;gmail;setting;delegate;help;get'= {
        }
        &'himalaya;gmail;setting;delegate;help;create'= {
        }
        &'himalaya;gmail;setting;delegate;help;delete'= {
        }
        &'himalaya;gmail;setting;delegate;help;help'= {
        }
        &'himalaya;gmail;settings;send-as'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand del 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand remove 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand rm 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;sendas'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand del 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand remove 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand rm 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;send-as;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;create'= {
            cand --display-name 'Display name shown in the From header for this alias'
            cand --reply-to-address 'Reply-To address to set on messages sent from this alias'
            cand --signature 'HTML signature appended to messages sent from this alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --treat-as-alias 'Treat this alias as an alias of the primary address'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;create'= {
            cand --display-name 'Display name shown in the From header for this alias'
            cand --reply-to-address 'Reply-To address to set on messages sent from this alias'
            cand --signature 'HTML signature appended to messages sent from this alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --treat-as-alias 'Treat this alias as an alias of the primary address'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;update'= {
            cand --display-name 'Display name shown in the From header for this alias'
            cand --reply-to-address 'Reply-To address to set on messages sent from this alias'
            cand --signature 'HTML signature appended to messages sent from this alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --treat-as-alias 'Treat this alias as an alias of the primary address'
            cand --patch 'Switch from a full update to a partial patch; without it the default update clears any field you omit'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;update'= {
            cand --display-name 'Display name shown in the From header for this alias'
            cand --reply-to-address 'Reply-To address to set on messages sent from this alias'
            cand --signature 'HTML signature appended to messages sent from this alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --treat-as-alias 'Treat this alias as an alias of the primary address'
            cand --patch 'Switch from a full update to a partial patch; without it the default update clears any field you omit'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;verify'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;sendas;verify'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;settings;send-as;help'= {
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;send-as;help;list'= {
        }
        &'himalaya;gmail;settings;send-as;help;get'= {
        }
        &'himalaya;gmail;settings;send-as;help;create'= {
        }
        &'himalaya;gmail;settings;send-as;help;update'= {
        }
        &'himalaya;gmail;settings;send-as;help;delete'= {
        }
        &'himalaya;gmail;settings;send-as;help;verify'= {
        }
        &'himalaya;gmail;settings;send-as;help;help'= {
        }
        &'himalaya;gmail;settings;sendas;help'= {
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;sendas;help;list'= {
        }
        &'himalaya;gmail;settings;sendas;help;get'= {
        }
        &'himalaya;gmail;settings;sendas;help;create'= {
        }
        &'himalaya;gmail;settings;sendas;help;update'= {
        }
        &'himalaya;gmail;settings;sendas;help;delete'= {
        }
        &'himalaya;gmail;settings;sendas;help;verify'= {
        }
        &'himalaya;gmail;settings;sendas;help;help'= {
        }
        &'himalaya;gmail;setting;send-as'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand del 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand remove 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand rm 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;sendas'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand del 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand remove 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand rm 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;send-as;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;create'= {
            cand --display-name 'Display name shown in the From header for this alias'
            cand --reply-to-address 'Reply-To address to set on messages sent from this alias'
            cand --signature 'HTML signature appended to messages sent from this alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --treat-as-alias 'Treat this alias as an alias of the primary address'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;create'= {
            cand --display-name 'Display name shown in the From header for this alias'
            cand --reply-to-address 'Reply-To address to set on messages sent from this alias'
            cand --signature 'HTML signature appended to messages sent from this alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --treat-as-alias 'Treat this alias as an alias of the primary address'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;update'= {
            cand --display-name 'Display name shown in the From header for this alias'
            cand --reply-to-address 'Reply-To address to set on messages sent from this alias'
            cand --signature 'HTML signature appended to messages sent from this alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --treat-as-alias 'Treat this alias as an alias of the primary address'
            cand --patch 'Switch from a full update to a partial patch; without it the default update clears any field you omit'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;update'= {
            cand --display-name 'Display name shown in the From header for this alias'
            cand --reply-to-address 'Reply-To address to set on messages sent from this alias'
            cand --signature 'HTML signature appended to messages sent from this alias'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --treat-as-alias 'Treat this alias as an alias of the primary address'
            cand --patch 'Switch from a full update to a partial patch; without it the default update clears any field you omit'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;verify'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;sendas;verify'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;gmail;setting;send-as;help'= {
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;send-as;help;list'= {
        }
        &'himalaya;gmail;setting;send-as;help;get'= {
        }
        &'himalaya;gmail;setting;send-as;help;create'= {
        }
        &'himalaya;gmail;setting;send-as;help;update'= {
        }
        &'himalaya;gmail;setting;send-as;help;delete'= {
        }
        &'himalaya;gmail;setting;send-as;help;verify'= {
        }
        &'himalaya;gmail;setting;send-as;help;help'= {
        }
        &'himalaya;gmail;setting;sendas;help'= {
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;sendas;help;list'= {
        }
        &'himalaya;gmail;setting;sendas;help;get'= {
        }
        &'himalaya;gmail;setting;sendas;help;create'= {
        }
        &'himalaya;gmail;setting;sendas;help;update'= {
        }
        &'himalaya;gmail;setting;sendas;help;delete'= {
        }
        &'himalaya;gmail;setting;sendas;help;verify'= {
        }
        &'himalaya;gmail;setting;sendas;help;help'= {
        }
        &'himalaya;gmail;settings;help'= {
            cand vacation 'Manage the Gmail vacation responder settings (users.settings.getVacation / updateVacation)'
            cand imap 'Manage the Gmail IMAP access settings (users.settings.getImap / updateImap)'
            cand pop 'Manage the Gmail POP access settings (users.settings.getPop / updatePop)'
            cand language 'Manage the Gmail display language settings (users.settings.getLanguage / updateLanguage)'
            cand auto-forwarding 'Manage the Gmail auto-forwarding settings (users.settings.getAutoForwarding / updateAutoForwarding)'
            cand filters 'Manage Gmail filters (users.settings.filters)'
            cand forwarding-addresses 'Manage Gmail forwarding addresses (users.settings.forwardingAddresses)'
            cand delegates 'Manage Gmail delegates (users.settings.delegates)'
            cand send-as 'Manage Gmail send-as aliases (settings.sendAs)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;settings;help;vacation'= {
            cand get 'Get the Gmail vacation responder settings'
            cand set 'Update the Gmail vacation responder settings'
        }
        &'himalaya;gmail;settings;help;vacation;get'= {
        }
        &'himalaya;gmail;settings;help;vacation;set'= {
        }
        &'himalaya;gmail;settings;help;imap'= {
            cand get 'Get the Gmail IMAP access settings'
            cand set 'Update the Gmail IMAP access settings'
        }
        &'himalaya;gmail;settings;help;imap;get'= {
        }
        &'himalaya;gmail;settings;help;imap;set'= {
        }
        &'himalaya;gmail;settings;help;pop'= {
            cand get 'Get the Gmail POP access settings'
            cand set 'Update the Gmail POP access settings'
        }
        &'himalaya;gmail;settings;help;pop;get'= {
        }
        &'himalaya;gmail;settings;help;pop;set'= {
        }
        &'himalaya;gmail;settings;help;language'= {
            cand get 'Get the Gmail display language settings'
            cand set 'Update the Gmail display language settings'
        }
        &'himalaya;gmail;settings;help;language;get'= {
        }
        &'himalaya;gmail;settings;help;language;set'= {
        }
        &'himalaya;gmail;settings;help;auto-forwarding'= {
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
        }
        &'himalaya;gmail;settings;help;auto-forwarding;get'= {
        }
        &'himalaya;gmail;settings;help;auto-forwarding;set'= {
        }
        &'himalaya;gmail;settings;help;filters'= {
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
        }
        &'himalaya;gmail;settings;help;filters;list'= {
        }
        &'himalaya;gmail;settings;help;filters;get'= {
        }
        &'himalaya;gmail;settings;help;filters;create'= {
        }
        &'himalaya;gmail;settings;help;filters;delete'= {
        }
        &'himalaya;gmail;settings;help;forwarding-addresses'= {
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
        }
        &'himalaya;gmail;settings;help;forwarding-addresses;list'= {
        }
        &'himalaya;gmail;settings;help;forwarding-addresses;get'= {
        }
        &'himalaya;gmail;settings;help;forwarding-addresses;create'= {
        }
        &'himalaya;gmail;settings;help;forwarding-addresses;delete'= {
        }
        &'himalaya;gmail;settings;help;delegates'= {
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
        }
        &'himalaya;gmail;settings;help;delegates;list'= {
        }
        &'himalaya;gmail;settings;help;delegates;get'= {
        }
        &'himalaya;gmail;settings;help;delegates;create'= {
        }
        &'himalaya;gmail;settings;help;delegates;delete'= {
        }
        &'himalaya;gmail;settings;help;send-as'= {
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
        }
        &'himalaya;gmail;settings;help;send-as;list'= {
        }
        &'himalaya;gmail;settings;help;send-as;get'= {
        }
        &'himalaya;gmail;settings;help;send-as;create'= {
        }
        &'himalaya;gmail;settings;help;send-as;update'= {
        }
        &'himalaya;gmail;settings;help;send-as;delete'= {
        }
        &'himalaya;gmail;settings;help;send-as;verify'= {
        }
        &'himalaya;gmail;settings;help;help'= {
        }
        &'himalaya;gmail;setting;help'= {
            cand vacation 'Manage the Gmail vacation responder settings (users.settings.getVacation / updateVacation)'
            cand imap 'Manage the Gmail IMAP access settings (users.settings.getImap / updateImap)'
            cand pop 'Manage the Gmail POP access settings (users.settings.getPop / updatePop)'
            cand language 'Manage the Gmail display language settings (users.settings.getLanguage / updateLanguage)'
            cand auto-forwarding 'Manage the Gmail auto-forwarding settings (users.settings.getAutoForwarding / updateAutoForwarding)'
            cand filters 'Manage Gmail filters (users.settings.filters)'
            cand forwarding-addresses 'Manage Gmail forwarding addresses (users.settings.forwardingAddresses)'
            cand delegates 'Manage Gmail delegates (users.settings.delegates)'
            cand send-as 'Manage Gmail send-as aliases (settings.sendAs)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;setting;help;vacation'= {
            cand get 'Get the Gmail vacation responder settings'
            cand set 'Update the Gmail vacation responder settings'
        }
        &'himalaya;gmail;setting;help;vacation;get'= {
        }
        &'himalaya;gmail;setting;help;vacation;set'= {
        }
        &'himalaya;gmail;setting;help;imap'= {
            cand get 'Get the Gmail IMAP access settings'
            cand set 'Update the Gmail IMAP access settings'
        }
        &'himalaya;gmail;setting;help;imap;get'= {
        }
        &'himalaya;gmail;setting;help;imap;set'= {
        }
        &'himalaya;gmail;setting;help;pop'= {
            cand get 'Get the Gmail POP access settings'
            cand set 'Update the Gmail POP access settings'
        }
        &'himalaya;gmail;setting;help;pop;get'= {
        }
        &'himalaya;gmail;setting;help;pop;set'= {
        }
        &'himalaya;gmail;setting;help;language'= {
            cand get 'Get the Gmail display language settings'
            cand set 'Update the Gmail display language settings'
        }
        &'himalaya;gmail;setting;help;language;get'= {
        }
        &'himalaya;gmail;setting;help;language;set'= {
        }
        &'himalaya;gmail;setting;help;auto-forwarding'= {
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
        }
        &'himalaya;gmail;setting;help;auto-forwarding;get'= {
        }
        &'himalaya;gmail;setting;help;auto-forwarding;set'= {
        }
        &'himalaya;gmail;setting;help;filters'= {
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
        }
        &'himalaya;gmail;setting;help;filters;list'= {
        }
        &'himalaya;gmail;setting;help;filters;get'= {
        }
        &'himalaya;gmail;setting;help;filters;create'= {
        }
        &'himalaya;gmail;setting;help;filters;delete'= {
        }
        &'himalaya;gmail;setting;help;forwarding-addresses'= {
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
        }
        &'himalaya;gmail;setting;help;forwarding-addresses;list'= {
        }
        &'himalaya;gmail;setting;help;forwarding-addresses;get'= {
        }
        &'himalaya;gmail;setting;help;forwarding-addresses;create'= {
        }
        &'himalaya;gmail;setting;help;forwarding-addresses;delete'= {
        }
        &'himalaya;gmail;setting;help;delegates'= {
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
        }
        &'himalaya;gmail;setting;help;delegates;list'= {
        }
        &'himalaya;gmail;setting;help;delegates;get'= {
        }
        &'himalaya;gmail;setting;help;delegates;create'= {
        }
        &'himalaya;gmail;setting;help;delegates;delete'= {
        }
        &'himalaya;gmail;setting;help;send-as'= {
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
        }
        &'himalaya;gmail;setting;help;send-as;list'= {
        }
        &'himalaya;gmail;setting;help;send-as;get'= {
        }
        &'himalaya;gmail;setting;help;send-as;create'= {
        }
        &'himalaya;gmail;setting;help;send-as;update'= {
        }
        &'himalaya;gmail;setting;help;send-as;delete'= {
        }
        &'himalaya;gmail;setting;help;send-as;verify'= {
        }
        &'himalaya;gmail;setting;help;help'= {
        }
        &'himalaya;gmail;help'= {
            cand profile 'Manage the Gmail user profile (users.getProfile)'
            cand labels 'Manage Gmail labels (users.labels)'
            cand messages 'Manage Gmail messages (users.messages)'
            cand attachments 'Manage Gmail message attachments (messages.attachments)'
            cand drafts 'Manage Gmail drafts (users.drafts)'
            cand threads 'Manage Gmail threads (users.threads)'
            cand history 'Manage the Gmail mailbox history (users.history)'
            cand settings 'Manage Gmail settings (users.settings), organized by sub-resource'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;gmail;help;profile'= {
            cand get 'Get the Gmail profile: email address, message/thread totals and the current history id'
        }
        &'himalaya;gmail;help;profile;get'= {
        }
        &'himalaya;gmail;help;labels'= {
            cand list 'List all Gmail labels (users.labels.list)'
            cand get 'Get one or more Gmail labels by identifier (users.labels.get)'
            cand create 'Create a Gmail label (users.labels.create)'
            cand update 'Update a Gmail label name (users.labels.update)'
            cand delete 'Delete a Gmail label (users.labels.delete)'
        }
        &'himalaya;gmail;help;labels;list'= {
        }
        &'himalaya;gmail;help;labels;get'= {
        }
        &'himalaya;gmail;help;labels;create'= {
        }
        &'himalaya;gmail;help;labels;update'= {
        }
        &'himalaya;gmail;help;labels;delete'= {
        }
        &'himalaya;gmail;help;messages'= {
            cand list 'List Gmail message ids matching the given query and labels (users.messages.list)'
            cand get 'Get a single Gmail message (users.messages.get)'
            cand send 'Send a Gmail message (users.messages.send)'
            cand import 'Import a Gmail message into the mailbox (users.messages.import)'
            cand insert 'Insert a Gmail message into the mailbox without sending (users.messages.insert)'
            cand modify 'Modify the labels of a Gmail message (users.messages.modify)'
            cand trash 'Move a Gmail message to the trash (users.messages.trash)'
            cand untrash 'Remove a Gmail message from the trash (users.messages.untrash)'
            cand delete 'Permanently delete a Gmail message (users.messages.delete)'
            cand batch-modify 'Modify the labels of several Gmail messages at once (users.messages.batchModify)'
            cand batch-delete 'Permanently delete several Gmail messages at once (users.messages.batchDelete)'
        }
        &'himalaya;gmail;help;messages;list'= {
        }
        &'himalaya;gmail;help;messages;get'= {
        }
        &'himalaya;gmail;help;messages;send'= {
        }
        &'himalaya;gmail;help;messages;import'= {
        }
        &'himalaya;gmail;help;messages;insert'= {
        }
        &'himalaya;gmail;help;messages;modify'= {
        }
        &'himalaya;gmail;help;messages;trash'= {
        }
        &'himalaya;gmail;help;messages;untrash'= {
        }
        &'himalaya;gmail;help;messages;delete'= {
        }
        &'himalaya;gmail;help;messages;batch-modify'= {
        }
        &'himalaya;gmail;help;messages;batch-delete'= {
        }
        &'himalaya;gmail;help;attachments'= {
            cand get 'Get a Gmail attachment by message and attachment id, then print or save its decoded bytes'
        }
        &'himalaya;gmail;help;attachments;get'= {
        }
        &'himalaya;gmail;help;drafts'= {
            cand list 'List Gmail drafts (users.drafts.list)'
            cand get 'Get a single Gmail draft (users.drafts.get)'
            cand create 'Create a Gmail draft (users.drafts.create)'
            cand update 'Update a Gmail draft (users.drafts.update)'
            cand send 'Send a Gmail draft (users.drafts.send)'
            cand delete 'Permanently delete a Gmail draft (users.drafts.delete)'
        }
        &'himalaya;gmail;help;drafts;list'= {
        }
        &'himalaya;gmail;help;drafts;get'= {
        }
        &'himalaya;gmail;help;drafts;create'= {
        }
        &'himalaya;gmail;help;drafts;update'= {
        }
        &'himalaya;gmail;help;drafts;send'= {
        }
        &'himalaya;gmail;help;drafts;delete'= {
        }
        &'himalaya;gmail;help;threads'= {
            cand list 'List Gmail threads matching the given query and labels (users.threads.list)'
            cand get 'Get a single Gmail thread with all its messages (users.threads.get)'
            cand modify 'Modify the labels of every message in a Gmail thread (users.threads.modify)'
            cand trash 'Move a Gmail thread to the trash (users.threads.trash)'
            cand untrash 'Remove a Gmail thread from the trash (users.threads.untrash)'
            cand delete 'Permanently delete a Gmail thread (users.threads.delete)'
        }
        &'himalaya;gmail;help;threads;list'= {
        }
        &'himalaya;gmail;help;threads;get'= {
        }
        &'himalaya;gmail;help;threads;modify'= {
        }
        &'himalaya;gmail;help;threads;trash'= {
        }
        &'himalaya;gmail;help;threads;untrash'= {
        }
        &'himalaya;gmail;help;threads;delete'= {
        }
        &'himalaya;gmail;help;history'= {
            cand list 'List the changes applied to the mailbox since a given history id'
        }
        &'himalaya;gmail;help;history;list'= {
        }
        &'himalaya;gmail;help;settings'= {
            cand vacation 'Manage the Gmail vacation responder settings (users.settings.getVacation / updateVacation)'
            cand imap 'Manage the Gmail IMAP access settings (users.settings.getImap / updateImap)'
            cand pop 'Manage the Gmail POP access settings (users.settings.getPop / updatePop)'
            cand language 'Manage the Gmail display language settings (users.settings.getLanguage / updateLanguage)'
            cand auto-forwarding 'Manage the Gmail auto-forwarding settings (users.settings.getAutoForwarding / updateAutoForwarding)'
            cand filters 'Manage Gmail filters (users.settings.filters)'
            cand forwarding-addresses 'Manage Gmail forwarding addresses (users.settings.forwardingAddresses)'
            cand delegates 'Manage Gmail delegates (users.settings.delegates)'
            cand send-as 'Manage Gmail send-as aliases (settings.sendAs)'
        }
        &'himalaya;gmail;help;settings;vacation'= {
            cand get 'Get the Gmail vacation responder settings'
            cand set 'Update the Gmail vacation responder settings'
        }
        &'himalaya;gmail;help;settings;vacation;get'= {
        }
        &'himalaya;gmail;help;settings;vacation;set'= {
        }
        &'himalaya;gmail;help;settings;imap'= {
            cand get 'Get the Gmail IMAP access settings'
            cand set 'Update the Gmail IMAP access settings'
        }
        &'himalaya;gmail;help;settings;imap;get'= {
        }
        &'himalaya;gmail;help;settings;imap;set'= {
        }
        &'himalaya;gmail;help;settings;pop'= {
            cand get 'Get the Gmail POP access settings'
            cand set 'Update the Gmail POP access settings'
        }
        &'himalaya;gmail;help;settings;pop;get'= {
        }
        &'himalaya;gmail;help;settings;pop;set'= {
        }
        &'himalaya;gmail;help;settings;language'= {
            cand get 'Get the Gmail display language settings'
            cand set 'Update the Gmail display language settings'
        }
        &'himalaya;gmail;help;settings;language;get'= {
        }
        &'himalaya;gmail;help;settings;language;set'= {
        }
        &'himalaya;gmail;help;settings;auto-forwarding'= {
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
        }
        &'himalaya;gmail;help;settings;auto-forwarding;get'= {
        }
        &'himalaya;gmail;help;settings;auto-forwarding;set'= {
        }
        &'himalaya;gmail;help;settings;filters'= {
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
        }
        &'himalaya;gmail;help;settings;filters;list'= {
        }
        &'himalaya;gmail;help;settings;filters;get'= {
        }
        &'himalaya;gmail;help;settings;filters;create'= {
        }
        &'himalaya;gmail;help;settings;filters;delete'= {
        }
        &'himalaya;gmail;help;settings;forwarding-addresses'= {
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
        }
        &'himalaya;gmail;help;settings;forwarding-addresses;list'= {
        }
        &'himalaya;gmail;help;settings;forwarding-addresses;get'= {
        }
        &'himalaya;gmail;help;settings;forwarding-addresses;create'= {
        }
        &'himalaya;gmail;help;settings;forwarding-addresses;delete'= {
        }
        &'himalaya;gmail;help;settings;delegates'= {
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
        }
        &'himalaya;gmail;help;settings;delegates;list'= {
        }
        &'himalaya;gmail;help;settings;delegates;get'= {
        }
        &'himalaya;gmail;help;settings;delegates;create'= {
        }
        &'himalaya;gmail;help;settings;delegates;delete'= {
        }
        &'himalaya;gmail;help;settings;send-as'= {
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
        }
        &'himalaya;gmail;help;settings;send-as;list'= {
        }
        &'himalaya;gmail;help;settings;send-as;get'= {
        }
        &'himalaya;gmail;help;settings;send-as;create'= {
        }
        &'himalaya;gmail;help;settings;send-as;update'= {
        }
        &'himalaya;gmail;help;settings;send-as;delete'= {
        }
        &'himalaya;gmail;help;settings;send-as;verify'= {
        }
        &'himalaya;gmail;help;help'= {
        }
        &'himalaya;msgraph'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand profile 'Manage the Microsoft Graph signed-in user (`GET /me`)'
            cand mail-folder 'Manage Microsoft Graph mail folders (`me.mailFolders`)'
            cand mail-folders 'Manage Microsoft Graph mail folders (`me.mailFolders`)'
            cand folder 'Manage Microsoft Graph mail folders (`me.mailFolders`)'
            cand folders 'Manage Microsoft Graph mail folders (`me.mailFolders`)'
            cand message 'Manage Microsoft Graph messages (`me.messages`)'
            cand messages 'Manage Microsoft Graph messages (`me.messages`)'
            cand msg 'Manage Microsoft Graph messages (`me.messages`)'
            cand attachment 'Manage Microsoft Graph message attachments (`me.messages.attachments`)'
            cand attachments 'Manage Microsoft Graph message attachments (`me.messages.attachments`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;profile'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand get 'Get the Microsoft Graph user profile: id, display name, mail and user principal name'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;profile;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;profile;help'= {
            cand get 'Get the Microsoft Graph user profile: id, display name, mail and user principal name'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;profile;help;get'= {
        }
        &'himalaya;msgraph;profile;help;help'= {
        }
        &'himalaya;msgraph;mail-folder'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand children 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand child 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand del 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand remove 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand rm 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;mail-folders'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand children 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand child 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand del 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand remove 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand rm 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;folder'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand children 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand child 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand del 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand remove 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand rm 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;folders'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand children 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand child 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand del 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand remove 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand rm 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;mail-folder;list'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;list'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;list'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;list'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;child-folders'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;children'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;child'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;child-folders'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;children'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;child'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;child-folders'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;children'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;child'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;child-folders'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;children'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;child'= {
            cand --top 'Maximum number of folders to return (OData `$top`)'
            cand --skip 'Number of folders to skip (OData `$skip`)'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `displayName,totalItemCount`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --hidden 'Also include hidden folders'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;rename'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;rename'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;rename'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;rename'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;copy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;copy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;copy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;copy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;move'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;move'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;move'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;move'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folders;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folder;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;folders;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;mail-folder;help'= {
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;mail-folder;help;list'= {
        }
        &'himalaya;msgraph;mail-folder;help;child-folders'= {
        }
        &'himalaya;msgraph;mail-folder;help;get'= {
        }
        &'himalaya;msgraph;mail-folder;help;create'= {
        }
        &'himalaya;msgraph;mail-folder;help;rename'= {
        }
        &'himalaya;msgraph;mail-folder;help;copy'= {
        }
        &'himalaya;msgraph;mail-folder;help;move'= {
        }
        &'himalaya;msgraph;mail-folder;help;delete'= {
        }
        &'himalaya;msgraph;mail-folder;help;help'= {
        }
        &'himalaya;msgraph;mail-folders;help'= {
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;mail-folders;help;list'= {
        }
        &'himalaya;msgraph;mail-folders;help;child-folders'= {
        }
        &'himalaya;msgraph;mail-folders;help;get'= {
        }
        &'himalaya;msgraph;mail-folders;help;create'= {
        }
        &'himalaya;msgraph;mail-folders;help;rename'= {
        }
        &'himalaya;msgraph;mail-folders;help;copy'= {
        }
        &'himalaya;msgraph;mail-folders;help;move'= {
        }
        &'himalaya;msgraph;mail-folders;help;delete'= {
        }
        &'himalaya;msgraph;mail-folders;help;help'= {
        }
        &'himalaya;msgraph;folder;help'= {
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;folder;help;list'= {
        }
        &'himalaya;msgraph;folder;help;child-folders'= {
        }
        &'himalaya;msgraph;folder;help;get'= {
        }
        &'himalaya;msgraph;folder;help;create'= {
        }
        &'himalaya;msgraph;folder;help;rename'= {
        }
        &'himalaya;msgraph;folder;help;copy'= {
        }
        &'himalaya;msgraph;folder;help;move'= {
        }
        &'himalaya;msgraph;folder;help;delete'= {
        }
        &'himalaya;msgraph;folder;help;help'= {
        }
        &'himalaya;msgraph;folders;help'= {
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;folders;help;list'= {
        }
        &'himalaya;msgraph;folders;help;child-folders'= {
        }
        &'himalaya;msgraph;folders;help;get'= {
        }
        &'himalaya;msgraph;folders;help;create'= {
        }
        &'himalaya;msgraph;folders;help;rename'= {
        }
        &'himalaya;msgraph;folders;help;copy'= {
        }
        &'himalaya;msgraph;folders;help;move'= {
        }
        &'himalaya;msgraph;folders;help;delete'= {
        }
        &'himalaya;msgraph;folders;help;help'= {
        }
        &'himalaya;msgraph;message'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Microsoft Graph messages (`GET /me/messages` or, with `--folder`, `GET /me/mailFolders/{id}/messages`)'
            cand get 'Get a single Microsoft Graph message (`GET /me/messages/{id}`), or its raw RFC 5322 bytes with `--raw` (`GET /me/messages/{id}/$value`)'
            cand create 'Create a Microsoft Graph draft message from raw MIME (`POST /me/messages`)'
            cand update 'Update a Microsoft Graph message (`PATCH /me/messages/{id}`): mark read/unread, set importance or replace categories'
            cand send 'Send a Microsoft Graph message from raw MIME (`POST /me/sendMail`); Graph saves it to Sent Items'
            cand copy 'Copy a Microsoft Graph message into another folder (`POST /me/messages/{id}/copy`)'
            cand move 'Move a Microsoft Graph message into another folder (`POST /me/messages/{id}/move`)'
            cand delete 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand del 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand remove 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand rm 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;messages'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Microsoft Graph messages (`GET /me/messages` or, with `--folder`, `GET /me/mailFolders/{id}/messages`)'
            cand get 'Get a single Microsoft Graph message (`GET /me/messages/{id}`), or its raw RFC 5322 bytes with `--raw` (`GET /me/messages/{id}/$value`)'
            cand create 'Create a Microsoft Graph draft message from raw MIME (`POST /me/messages`)'
            cand update 'Update a Microsoft Graph message (`PATCH /me/messages/{id}`): mark read/unread, set importance or replace categories'
            cand send 'Send a Microsoft Graph message from raw MIME (`POST /me/sendMail`); Graph saves it to Sent Items'
            cand copy 'Copy a Microsoft Graph message into another folder (`POST /me/messages/{id}/copy`)'
            cand move 'Move a Microsoft Graph message into another folder (`POST /me/messages/{id}/move`)'
            cand delete 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand del 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand remove 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand rm 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;msg'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List Microsoft Graph messages (`GET /me/messages` or, with `--folder`, `GET /me/mailFolders/{id}/messages`)'
            cand get 'Get a single Microsoft Graph message (`GET /me/messages/{id}`), or its raw RFC 5322 bytes with `--raw` (`GET /me/messages/{id}/$value`)'
            cand create 'Create a Microsoft Graph draft message from raw MIME (`POST /me/messages`)'
            cand update 'Update a Microsoft Graph message (`PATCH /me/messages/{id}`): mark read/unread, set importance or replace categories'
            cand send 'Send a Microsoft Graph message from raw MIME (`POST /me/sendMail`); Graph saves it to Sent Items'
            cand copy 'Copy a Microsoft Graph message into another folder (`POST /me/messages/{id}/copy`)'
            cand move 'Move a Microsoft Graph message into another folder (`POST /me/messages/{id}/move`)'
            cand delete 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand del 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand remove 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand rm 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;message;list'= {
            cand -f 'Restrict the listing to a folder id or well-known name (e.g. `inbox`). Lists the whole mailbox when omitted'
            cand --folder 'Restrict the listing to a folder id or well-known name (e.g. `inbox`). Lists the whole mailbox when omitted'
            cand --top 'Maximum number of messages to return (OData `$top`)'
            cand --skip 'Number of messages to skip (OData `$skip`)'
            cand --filter 'OData `$filter` expression (e.g. `isRead eq false`)'
            cand --search 'OData `$search` query (e.g. `subject:report` or a bare term)'
            cand --orderby 'OData `$orderby` expression. Defaults to `receivedDateTime desc`'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `subject,from,receivedDateTime`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --count 'Request the total count of matching messages (OData `$count`)'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;list'= {
            cand -f 'Restrict the listing to a folder id or well-known name (e.g. `inbox`). Lists the whole mailbox when omitted'
            cand --folder 'Restrict the listing to a folder id or well-known name (e.g. `inbox`). Lists the whole mailbox when omitted'
            cand --top 'Maximum number of messages to return (OData `$top`)'
            cand --skip 'Number of messages to skip (OData `$skip`)'
            cand --filter 'OData `$filter` expression (e.g. `isRead eq false`)'
            cand --search 'OData `$search` query (e.g. `subject:report` or a bare term)'
            cand --orderby 'OData `$orderby` expression. Defaults to `receivedDateTime desc`'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `subject,from,receivedDateTime`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --count 'Request the total count of matching messages (OData `$count`)'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;list'= {
            cand -f 'Restrict the listing to a folder id or well-known name (e.g. `inbox`). Lists the whole mailbox when omitted'
            cand --folder 'Restrict the listing to a folder id or well-known name (e.g. `inbox`). Lists the whole mailbox when omitted'
            cand --top 'Maximum number of messages to return (OData `$top`)'
            cand --skip 'Number of messages to skip (OData `$skip`)'
            cand --filter 'OData `$filter` expression (e.g. `isRead eq false`)'
            cand --search 'OData `$search` query (e.g. `subject:report` or a bare term)'
            cand --orderby 'OData `$orderby` expression. Defaults to `receivedDateTime desc`'
            cand --select 'OData `$select`: comma-separated fields to return (e.g. `subject,from,receivedDateTime`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --count 'Request the total count of matching messages (OData `$count`)'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --raw 'Return the raw RFC 5322 MIME message instead of the parsed fields'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --raw 'Return the raw RFC 5322 MIME message instead of the parsed fields'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;get'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --raw 'Return the raw RFC 5322 MIME message instead of the parsed fields'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;create'= {
            cand -f 'Create the draft in this folder id or well-known name (e.g. `drafts`). Defaults to the mailbox root'
            cand --folder 'Create the draft in this folder id or well-known name (e.g. `drafts`). Defaults to the mailbox root'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;create'= {
            cand -f 'Create the draft in this folder id or well-known name (e.g. `drafts`). Defaults to the mailbox root'
            cand --folder 'Create the draft in this folder id or well-known name (e.g. `drafts`). Defaults to the mailbox root'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;create'= {
            cand -f 'Create the draft in this folder id or well-known name (e.g. `drafts`). Defaults to the mailbox root'
            cand --folder 'Create the draft in this folder id or well-known name (e.g. `drafts`). Defaults to the mailbox root'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;update'= {
            cand --importance 'Set the message importance'
            cand --category 'Category to set on the message. Can be repeated; replaces the existing categories'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --read 'Mark the message as read'
            cand --unread 'Mark the message as unread'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;update'= {
            cand --importance 'Set the message importance'
            cand --category 'Category to set on the message. Can be repeated; replaces the existing categories'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --read 'Mark the message as read'
            cand --unread 'Mark the message as unread'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;update'= {
            cand --importance 'Set the message importance'
            cand --category 'Category to set on the message. Can be repeated; replaces the existing categories'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --read 'Mark the message as read'
            cand --unread 'Mark the message as unread'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;send'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;send'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;send'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;copy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;copy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;copy'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;move'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;move'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;move'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;messages;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;msg;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;message;help'= {
            cand list 'List Microsoft Graph messages (`GET /me/messages` or, with `--folder`, `GET /me/mailFolders/{id}/messages`)'
            cand get 'Get a single Microsoft Graph message (`GET /me/messages/{id}`), or its raw RFC 5322 bytes with `--raw` (`GET /me/messages/{id}/$value`)'
            cand create 'Create a Microsoft Graph draft message from raw MIME (`POST /me/messages`)'
            cand update 'Update a Microsoft Graph message (`PATCH /me/messages/{id}`): mark read/unread, set importance or replace categories'
            cand send 'Send a Microsoft Graph message from raw MIME (`POST /me/sendMail`); Graph saves it to Sent Items'
            cand copy 'Copy a Microsoft Graph message into another folder (`POST /me/messages/{id}/copy`)'
            cand move 'Move a Microsoft Graph message into another folder (`POST /me/messages/{id}/move`)'
            cand delete 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;message;help;list'= {
        }
        &'himalaya;msgraph;message;help;get'= {
        }
        &'himalaya;msgraph;message;help;create'= {
        }
        &'himalaya;msgraph;message;help;update'= {
        }
        &'himalaya;msgraph;message;help;send'= {
        }
        &'himalaya;msgraph;message;help;copy'= {
        }
        &'himalaya;msgraph;message;help;move'= {
        }
        &'himalaya;msgraph;message;help;delete'= {
        }
        &'himalaya;msgraph;message;help;help'= {
        }
        &'himalaya;msgraph;messages;help'= {
            cand list 'List Microsoft Graph messages (`GET /me/messages` or, with `--folder`, `GET /me/mailFolders/{id}/messages`)'
            cand get 'Get a single Microsoft Graph message (`GET /me/messages/{id}`), or its raw RFC 5322 bytes with `--raw` (`GET /me/messages/{id}/$value`)'
            cand create 'Create a Microsoft Graph draft message from raw MIME (`POST /me/messages`)'
            cand update 'Update a Microsoft Graph message (`PATCH /me/messages/{id}`): mark read/unread, set importance or replace categories'
            cand send 'Send a Microsoft Graph message from raw MIME (`POST /me/sendMail`); Graph saves it to Sent Items'
            cand copy 'Copy a Microsoft Graph message into another folder (`POST /me/messages/{id}/copy`)'
            cand move 'Move a Microsoft Graph message into another folder (`POST /me/messages/{id}/move`)'
            cand delete 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;messages;help;list'= {
        }
        &'himalaya;msgraph;messages;help;get'= {
        }
        &'himalaya;msgraph;messages;help;create'= {
        }
        &'himalaya;msgraph;messages;help;update'= {
        }
        &'himalaya;msgraph;messages;help;send'= {
        }
        &'himalaya;msgraph;messages;help;copy'= {
        }
        &'himalaya;msgraph;messages;help;move'= {
        }
        &'himalaya;msgraph;messages;help;delete'= {
        }
        &'himalaya;msgraph;messages;help;help'= {
        }
        &'himalaya;msgraph;msg;help'= {
            cand list 'List Microsoft Graph messages (`GET /me/messages` or, with `--folder`, `GET /me/mailFolders/{id}/messages`)'
            cand get 'Get a single Microsoft Graph message (`GET /me/messages/{id}`), or its raw RFC 5322 bytes with `--raw` (`GET /me/messages/{id}/$value`)'
            cand create 'Create a Microsoft Graph draft message from raw MIME (`POST /me/messages`)'
            cand update 'Update a Microsoft Graph message (`PATCH /me/messages/{id}`): mark read/unread, set importance or replace categories'
            cand send 'Send a Microsoft Graph message from raw MIME (`POST /me/sendMail`); Graph saves it to Sent Items'
            cand copy 'Copy a Microsoft Graph message into another folder (`POST /me/messages/{id}/copy`)'
            cand move 'Move a Microsoft Graph message into another folder (`POST /me/messages/{id}/move`)'
            cand delete 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;msg;help;list'= {
        }
        &'himalaya;msgraph;msg;help;get'= {
        }
        &'himalaya;msgraph;msg;help;create'= {
        }
        &'himalaya;msgraph;msg;help;update'= {
        }
        &'himalaya;msgraph;msg;help;send'= {
        }
        &'himalaya;msgraph;msg;help;copy'= {
        }
        &'himalaya;msgraph;msg;help;move'= {
        }
        &'himalaya;msgraph;msg;help;delete'= {
        }
        &'himalaya;msgraph;msg;help;help'= {
        }
        &'himalaya;msgraph;attachment'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List a message''s attachments (`GET /me/messages/{id}/attachments`)'
            cand get 'Download an attachment''s content (`GET /me/messages/{id}/attachments/{aid}/$value`), then print or save its bytes'
            cand create 'Add a file attachment to a message (`POST /me/messages/{id}/attachments`)'
            cand delete 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand del 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand remove 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand rm 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;attachments'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List a message''s attachments (`GET /me/messages/{id}/attachments`)'
            cand get 'Download an attachment''s content (`GET /me/messages/{id}/attachments/{aid}/$value`), then print or save its bytes'
            cand create 'Add a file attachment to a message (`POST /me/messages/{id}/attachments`)'
            cand delete 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand del 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand remove 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand rm 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;attachment;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachments;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachment;get'= {
            cand -o 'Save the attachment to this path instead of printing its bytes'
            cand --output 'Save the attachment to this path instead of printing its bytes'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachments;get'= {
            cand -o 'Save the attachment to this path instead of printing its bytes'
            cand --output 'Save the attachment to this path instead of printing its bytes'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachment;create'= {
            cand -n 'Override the attachment name (defaults to the file name)'
            cand --name 'Override the attachment name (defaults to the file name)'
            cand -t 'Set the attachment content type (e.g. `application/pdf`)'
            cand --content-type 'Set the attachment content type (e.g. `application/pdf`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachments;create'= {
            cand -n 'Override the attachment name (defaults to the file name)'
            cand --name 'Override the attachment name (defaults to the file name)'
            cand -t 'Set the attachment content type (e.g. `application/pdf`)'
            cand --content-type 'Set the attachment content type (e.g. `application/pdf`)'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachment;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachment;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachment;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachment;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachments;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachments;del'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachments;remove'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachments;rm'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;msgraph;attachment;help'= {
            cand list 'List a message''s attachments (`GET /me/messages/{id}/attachments`)'
            cand get 'Download an attachment''s content (`GET /me/messages/{id}/attachments/{aid}/$value`), then print or save its bytes'
            cand create 'Add a file attachment to a message (`POST /me/messages/{id}/attachments`)'
            cand delete 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;attachment;help;list'= {
        }
        &'himalaya;msgraph;attachment;help;get'= {
        }
        &'himalaya;msgraph;attachment;help;create'= {
        }
        &'himalaya;msgraph;attachment;help;delete'= {
        }
        &'himalaya;msgraph;attachment;help;help'= {
        }
        &'himalaya;msgraph;attachments;help'= {
            cand list 'List a message''s attachments (`GET /me/messages/{id}/attachments`)'
            cand get 'Download an attachment''s content (`GET /me/messages/{id}/attachments/{aid}/$value`), then print or save its bytes'
            cand create 'Add a file attachment to a message (`POST /me/messages/{id}/attachments`)'
            cand delete 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;attachments;help;list'= {
        }
        &'himalaya;msgraph;attachments;help;get'= {
        }
        &'himalaya;msgraph;attachments;help;create'= {
        }
        &'himalaya;msgraph;attachments;help;delete'= {
        }
        &'himalaya;msgraph;attachments;help;help'= {
        }
        &'himalaya;msgraph;help'= {
            cand profile 'Manage the Microsoft Graph signed-in user (`GET /me`)'
            cand mail-folder 'Manage Microsoft Graph mail folders (`me.mailFolders`)'
            cand message 'Manage Microsoft Graph messages (`me.messages`)'
            cand attachment 'Manage Microsoft Graph message attachments (`me.messages.attachments`)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;msgraph;help;profile'= {
            cand get 'Get the Microsoft Graph user profile: id, display name, mail and user principal name'
        }
        &'himalaya;msgraph;help;profile;get'= {
        }
        &'himalaya;msgraph;help;mail-folder'= {
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
        }
        &'himalaya;msgraph;help;mail-folder;list'= {
        }
        &'himalaya;msgraph;help;mail-folder;child-folders'= {
        }
        &'himalaya;msgraph;help;mail-folder;get'= {
        }
        &'himalaya;msgraph;help;mail-folder;create'= {
        }
        &'himalaya;msgraph;help;mail-folder;rename'= {
        }
        &'himalaya;msgraph;help;mail-folder;copy'= {
        }
        &'himalaya;msgraph;help;mail-folder;move'= {
        }
        &'himalaya;msgraph;help;mail-folder;delete'= {
        }
        &'himalaya;msgraph;help;message'= {
            cand list 'List Microsoft Graph messages (`GET /me/messages` or, with `--folder`, `GET /me/mailFolders/{id}/messages`)'
            cand get 'Get a single Microsoft Graph message (`GET /me/messages/{id}`), or its raw RFC 5322 bytes with `--raw` (`GET /me/messages/{id}/$value`)'
            cand create 'Create a Microsoft Graph draft message from raw MIME (`POST /me/messages`)'
            cand update 'Update a Microsoft Graph message (`PATCH /me/messages/{id}`): mark read/unread, set importance or replace categories'
            cand send 'Send a Microsoft Graph message from raw MIME (`POST /me/sendMail`); Graph saves it to Sent Items'
            cand copy 'Copy a Microsoft Graph message into another folder (`POST /me/messages/{id}/copy`)'
            cand move 'Move a Microsoft Graph message into another folder (`POST /me/messages/{id}/move`)'
            cand delete 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
        }
        &'himalaya;msgraph;help;message;list'= {
        }
        &'himalaya;msgraph;help;message;get'= {
        }
        &'himalaya;msgraph;help;message;create'= {
        }
        &'himalaya;msgraph;help;message;update'= {
        }
        &'himalaya;msgraph;help;message;send'= {
        }
        &'himalaya;msgraph;help;message;copy'= {
        }
        &'himalaya;msgraph;help;message;move'= {
        }
        &'himalaya;msgraph;help;message;delete'= {
        }
        &'himalaya;msgraph;help;attachment'= {
            cand list 'List a message''s attachments (`GET /me/messages/{id}/attachments`)'
            cand get 'Download an attachment''s content (`GET /me/messages/{id}/attachments/{aid}/$value`), then print or save its bytes'
            cand create 'Add a file attachment to a message (`POST /me/messages/{id}/attachments`)'
            cand delete 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
        }
        &'himalaya;msgraph;help;attachment;list'= {
        }
        &'himalaya;msgraph;help;attachment;get'= {
        }
        &'himalaya;msgraph;help;attachment;create'= {
        }
        &'himalaya;msgraph;help;attachment;delete'= {
        }
        &'himalaya;msgraph;help;help'= {
        }
        &'himalaya;maildir'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand create 'Create a Maildir folder'
            cand rename 'Rename a Maildir folder'
            cand delete 'Delete a Maildir folder'
            cand list 'List Maildir folders'
            cand messages 'Manage MAILDIR messages'
            cand flags 'Manage MAILDIR flags'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;maildir;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;rename'= {
            cand -m 'Path to the Maildir'
            cand --maildir 'Path to the Maildir'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;delete'= {
            cand -m 'Path to the Maildir'
            cand --maildir 'Path to the Maildir'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;messages'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand save 'Store a message into a Maildir folder'
            cand copy 'Copy Maildir message(s) to another folder'
            cand move 'Move Maildir message(s) to another folder'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;maildir;messages;save'= {
            cand -m 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand --maildir 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand -s 'The subdirectory of the Maildir'
            cand --subdir 'The subdirectory of the Maildir'
            cand -f 'The flags to add to the message'
            cand --flag 'The flags to add to the message'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;messages;copy'= {
            cand -m 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand --maildir 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand -t 'Path to the target Maildir'
            cand --target 'Path to the target Maildir'
            cand -s 'Copy the message into a different subdirectory'
            cand --subdir 'Copy the message into a different subdirectory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;messages;move'= {
            cand -m 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand --maildir 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand -t 'Path to the target Maildir'
            cand --target 'Path to the target Maildir'
            cand -s 'Move the message into a different subdirectory'
            cand --subdir 'Move the message into a different subdirectory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;messages;help'= {
            cand save 'Store a message into a Maildir folder'
            cand copy 'Copy Maildir message(s) to another folder'
            cand move 'Move Maildir message(s) to another folder'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;maildir;messages;help;save'= {
        }
        &'himalaya;maildir;messages;help;copy'= {
        }
        &'himalaya;maildir;messages;help;move'= {
        }
        &'himalaya;maildir;messages;help;help'= {
        }
        &'himalaya;maildir;flags'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List the standard Maildir flags'
            cand add 'Add MAILDIR flag(s) to message(s)'
            cand set 'Set MAILDIR flag(s) on message(s)'
            cand remove 'Remove MAILDIR flag(s) from message(s)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;maildir;flags;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;flags;add'= {
            cand -m 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand --maildir 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand -f 'Flag(s) to add to the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not swallowed as flags'
            cand --flag 'Flag(s) to add to the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not swallowed as flags'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;flags;set'= {
            cand -m 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand --maildir 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand -f 'Flag(s) to set on the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not swallowed as flags'
            cand --flag 'Flag(s) to set on the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not swallowed as flags'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;flags;remove'= {
            cand -m 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand --maildir 'Maildir folder, resolved relative to the account root. Must name an existing folder; use `.` for the root maildir itself (the INBOX in the default fs layout, where there is no `Inbox` subfolder). Defaults to `Inbox`'
            cand -f 'Flag(s) to remove from the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not swallowed as flags'
            cand --flag 'Flag(s) to remove from the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not swallowed as flags'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;maildir;flags;help'= {
            cand list 'List the standard Maildir flags'
            cand add 'Add MAILDIR flag(s) to message(s)'
            cand set 'Set MAILDIR flag(s) on message(s)'
            cand remove 'Remove MAILDIR flag(s) from message(s)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;maildir;flags;help;list'= {
        }
        &'himalaya;maildir;flags;help;add'= {
        }
        &'himalaya;maildir;flags;help;set'= {
        }
        &'himalaya;maildir;flags;help;remove'= {
        }
        &'himalaya;maildir;flags;help;help'= {
        }
        &'himalaya;maildir;help'= {
            cand create 'Create a Maildir folder'
            cand rename 'Rename a Maildir folder'
            cand delete 'Delete a Maildir folder'
            cand list 'List Maildir folders'
            cand messages 'Manage MAILDIR messages'
            cand flags 'Manage MAILDIR flags'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;maildir;help;create'= {
        }
        &'himalaya;maildir;help;rename'= {
        }
        &'himalaya;maildir;help;delete'= {
        }
        &'himalaya;maildir;help;list'= {
        }
        &'himalaya;maildir;help;messages'= {
            cand save 'Store a message into a Maildir folder'
            cand copy 'Copy Maildir message(s) to another folder'
            cand move 'Move Maildir message(s) to another folder'
        }
        &'himalaya;maildir;help;messages;save'= {
        }
        &'himalaya;maildir;help;messages;copy'= {
        }
        &'himalaya;maildir;help;messages;move'= {
        }
        &'himalaya;maildir;help;flags'= {
            cand list 'List the standard Maildir flags'
            cand add 'Add MAILDIR flag(s) to message(s)'
            cand set 'Set MAILDIR flag(s) on message(s)'
            cand remove 'Remove MAILDIR flag(s) from message(s)'
        }
        &'himalaya;maildir;help;flags;list'= {
        }
        &'himalaya;maildir;help;flags;add'= {
        }
        &'himalaya;maildir;help;flags;set'= {
        }
        &'himalaya;maildir;help;flags;remove'= {
        }
        &'himalaya;maildir;help;help'= {
        }
        &'himalaya;m2dir'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand create 'Create the given m2dir folder'
            cand delete 'Delete the given m2dir folder'
            cand list 'List m2dir folders found under the store root'
            cand messages 'Manage M2DIR messages'
            cand flags 'Manage M2DIR flags'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;m2dir;create'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;m2dir;delete'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;m2dir;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;m2dir;messages'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand save 'Save a message to an m2dir folder'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;m2dir;messages;save'= {
            cand -m 'Name of the m2dir folder, relative to the m2store root'
            cand --m2dir 'Name of the m2dir folder, relative to the m2store root'
            cand -f 'Flag(s) to write to the new message''s `.flags` metadata file. Each flag is an arbitrary UTF-8 string (e.g. `$seen`, `custom`); repeat `-f` per flag so one `-f` takes a single value'
            cand --flag 'Flag(s) to write to the new message''s `.flags` metadata file. Each flag is an arbitrary UTF-8 string (e.g. `$seen`, `custom`); repeat `-f` per flag so one `-f` takes a single value'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;m2dir;messages;help'= {
            cand save 'Save a message to an m2dir folder'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;m2dir;messages;help;save'= {
        }
        &'himalaya;m2dir;messages;help;help'= {
        }
        &'himalaya;m2dir;flags'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List flags set on an m2dir message'
            cand add 'Add M2DIR flag(s) to message(s)'
            cand set 'Set M2DIR flag(s) on message(s) (replaces any existing flags)'
            cand remove 'Remove M2DIR flag(s) from message(s)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;m2dir;flags;list'= {
            cand -m 'Name of the m2dir folder, relative to the m2store root'
            cand --m2dir 'Name of the m2dir folder, relative to the m2store root'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;m2dir;flags;add'= {
            cand -m 'Name of the m2dir folder, relative to the m2store root'
            cand --m2dir 'Name of the m2dir folder, relative to the m2store root'
            cand -f 'Flag(s) to add to the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not silently swallowed as flags'
            cand --flag 'Flag(s) to add to the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not silently swallowed as flags'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;m2dir;flags;set'= {
            cand -m 'Name of the m2dir folder, relative to the m2store root'
            cand --m2dir 'Name of the m2dir folder, relative to the m2store root'
            cand -f 'Flag(s) to set on the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not silently swallowed as flags'
            cand --flag 'Flag(s) to set on the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not silently swallowed as flags'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;m2dir;flags;remove'= {
            cand -m 'Name of the m2dir folder, relative to the m2store root'
            cand --m2dir 'Name of the m2dir folder, relative to the m2store root'
            cand -f 'Flag(s) to remove from the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not silently swallowed as flags'
            cand --flag 'Flag(s) to remove from the message. Repeat `-f` per flag (e.g. `-f seen -f flagged`); a single `-f` takes one value so trailing message ids are not silently swallowed as flags'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;m2dir;flags;help'= {
            cand list 'List flags set on an m2dir message'
            cand add 'Add M2DIR flag(s) to message(s)'
            cand set 'Set M2DIR flag(s) on message(s) (replaces any existing flags)'
            cand remove 'Remove M2DIR flag(s) from message(s)'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;m2dir;flags;help;list'= {
        }
        &'himalaya;m2dir;flags;help;add'= {
        }
        &'himalaya;m2dir;flags;help;set'= {
        }
        &'himalaya;m2dir;flags;help;remove'= {
        }
        &'himalaya;m2dir;flags;help;help'= {
        }
        &'himalaya;m2dir;help'= {
            cand create 'Create the given m2dir folder'
            cand delete 'Delete the given m2dir folder'
            cand list 'List m2dir folders found under the store root'
            cand messages 'Manage M2DIR messages'
            cand flags 'Manage M2DIR flags'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;m2dir;help;create'= {
        }
        &'himalaya;m2dir;help;delete'= {
        }
        &'himalaya;m2dir;help;list'= {
        }
        &'himalaya;m2dir;help;messages'= {
            cand save 'Save a message to an m2dir folder'
        }
        &'himalaya;m2dir;help;messages;save'= {
        }
        &'himalaya;m2dir;help;flags'= {
            cand list 'List flags set on an m2dir message'
            cand add 'Add M2DIR flag(s) to message(s)'
            cand set 'Set M2DIR flag(s) on message(s) (replaces any existing flags)'
            cand remove 'Remove M2DIR flag(s) from message(s)'
        }
        &'himalaya;m2dir;help;flags;list'= {
        }
        &'himalaya;m2dir;help;flags;add'= {
        }
        &'himalaya;m2dir;help;flags;set'= {
        }
        &'himalaya;m2dir;help;flags;remove'= {
        }
        &'himalaya;m2dir;help;help'= {
        }
        &'himalaya;smtp'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand send 'Send a raw RFC 5322 message (MAIL FROM / RCPT TO / DATA)'
            cand raw 'Send a raw SMTP command and print the verbatim reply'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;smtp;send'= {
            cand -f 'The envelope sender (MAIL FROM reverse path)'
            cand --mail-from 'The envelope sender (MAIL FROM reverse path)'
            cand -t 'The envelope recipient(s) (RCPT TO forward path); repeatable'
            cand --rcpt-to 'The envelope recipient(s) (RCPT TO forward path); repeatable'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;smtp;raw'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;smtp;help'= {
            cand send 'Send a raw RFC 5322 message (MAIL FROM / RCPT TO / DATA)'
            cand raw 'Send a raw SMTP command and print the verbatim reply'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;smtp;help;send'= {
        }
        &'himalaya;smtp;help;raw'= {
        }
        &'himalaya;smtp;help;help'= {
        }
        &'himalaya;configure'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;wizard'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;account'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
            cand list 'List all accounts declared in the configuration'
            cand ls 'List all accounts declared in the configuration'
            cand check 'Validate the account configuration'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;account;list'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;account;ls'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;account;check'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;account;help'= {
            cand list 'List all accounts declared in the configuration'
            cand check 'Validate the account configuration'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;account;help;list'= {
        }
        &'himalaya;account;help;check'= {
        }
        &'himalaya;account;help;help'= {
        }
        &'himalaya;completion'= {
            cand -d 'Save completion script to the given directory'
            cand --dir 'Save completion script to the given directory'
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;manual'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;json-schema'= {
            cand -c 'Override the default configuration file path'
            cand --config 'Override the default configuration file path'
            cand -a 'Override the default account'
            cand --account 'Override the default account'
            cand -b 'Force a specific backend for cross-protocol commands'
            cand --backend 'Force a specific backend for cross-protocol commands'
            cand --log-level 'Filter log output by level'
            cand --log 'Filter log output by level'
            cand --log-file 'Append log output to the given file instead of stderr'
            cand --json 'Enable JSON output'
            cand -h 'Print help (see more with ''--help'')'
            cand --help 'Print help (see more with ''--help'')'
            cand -V 'Print version'
            cand --version 'Print version'
        }
        &'himalaya;help'= {
            cand mailbox 'Manage mailboxes using the shared API'
            cand envelope 'Manage envelopes using the shared API'
            cand flag 'Manage flags using the shared API'
            cand message 'Manage messages using the shared API'
            cand attachment 'Manage attachments using the shared API'
            cand imap 'IMAP-specific API'
            cand jmap 'JMAP-specific API'
            cand gmail 'Gmail-specific API'
            cand msgraph 'Microsoft Graph CLI'
            cand maildir 'Maildir-specific API'
            cand m2dir 'M2dir-specific API'
            cand smtp 'SMTP-specific API'
            cand configure 'Configure an account interactively'
            cand account 'Manage accounts defined in the TOML configuration file'
            cand completion 'Generate completion script for the give shell(s) to the given directory'
            cand manual 'Generate manual pages to the given directory'
            cand json-schema 'Generate JSON Schemas of every command''s JSON output to the given directory'
            cand help 'Print this message or the help of the given subcommand(s)'
        }
        &'himalaya;help;mailbox'= {
            cand list 'Shared API to list mailboxes for the active account'
        }
        &'himalaya;help;mailbox;list'= {
        }
        &'himalaya;help;envelope'= {
            cand list 'List envelopes for the active account, regardless of the underlying backend'
            cand search 'Search envelopes for the active account using the shared search query DSL, regardless of the underlying backend'
        }
        &'himalaya;help;envelope;list'= {
        }
        &'himalaya;help;envelope;search'= {
        }
        &'himalaya;help;flag'= {
            cand add 'Add flag(s) to message(s) for the active account'
            cand set 'Replace flag(s) of message(s) for the active account'
            cand remove 'Remove flag(s) from message(s) for the active account'
        }
        &'himalaya;help;flag;add'= {
        }
        &'himalaya;help;flag;set'= {
        }
        &'himalaya;help;flag;remove'= {
        }
        &'himalaya;help;message'= {
            cand add 'Add a raw RFC 5322 message to a mailbox'
            cand compose 'Compose a new message from CLI arguments (built-in flag composer)'
            cand copy 'Copy message(s) from one mailbox to another within the active account'
            cand delete 'Delete message(s) from the active account'
            cand forward 'Forward a message using the built-in flag composer'
            cand move 'Move message(s) from one mailbox to another within the active account'
            cand read 'Read a message from the active account (built-in flag reader)'
            cand reply 'Reply to a message using the built-in flag composer'
            cand send 'Send a message via the active account'
        }
        &'himalaya;help;message;add'= {
        }
        &'himalaya;help;message;compose'= {
        }
        &'himalaya;help;message;copy'= {
        }
        &'himalaya;help;message;delete'= {
        }
        &'himalaya;help;message;forward'= {
        }
        &'himalaya;help;message;move'= {
        }
        &'himalaya;help;message;read'= {
        }
        &'himalaya;help;message;reply'= {
        }
        &'himalaya;help;message;send'= {
        }
        &'himalaya;help;attachment'= {
            cand list 'List the attachments carried by a single message in the active account'
            cand download 'Download specific attachments of a single message to disk'
        }
        &'himalaya;help;attachment;list'= {
        }
        &'himalaya;help;attachment;download'= {
        }
        &'himalaya;help;imap'= {
            cand id 'Get information about the IMAP server'
            cand select 'Select the given mailbox (SELECT, RFC 3501)'
            cand create 'Create the given mailbox (CREATE, RFC 3501)'
            cand delete 'Delete the given mailbox (DELETE, RFC 3501)'
            cand rename 'Rename the given mailbox (RENAME, RFC 3501)'
            cand subscribe 'Subscribe to the given mailbox (SUBSCRIBE, RFC 3501)'
            cand unsubscribe 'Unsubscribe from the given mailbox (UNSUBSCRIBE, RFC 3501)'
            cand list 'List mailboxes (LIST / LSUB, RFC 3501)'
            cand status 'Get the status of the given mailbox (STATUS, RFC 3501)'
            cand close 'Close the selected mailbox (CLOSE, RFC 3501)'
            cand unselect 'Unselect the selected mailbox (UNSELECT, RFC 3691)'
            cand expunge 'Expunge the given mailbox (EXPUNGE, RFC 3501)'
            cand search 'Search IMAP messages (SEARCH, RFC 3501)'
            cand sort 'Sort IMAP messages (SORT, RFC 5256)'
            cand thread 'Thread IMAP messages (THREAD, RFC 5256)'
            cand store 'Store IMAP flags on message(s) (STORE, RFC 3501)'
            cand flags 'List the flags available in the given mailbox (SELECT response, RFC 3501)'
            cand fetch 'Fetch IMAP message data items (FETCH, RFC 3501)'
            cand append 'Append a message to a mailbox (APPEND, RFC 3501)'
            cand copy 'Copy IMAP message(s) to the given mailbox (COPY, RFC 3501)'
            cand move 'Move IMAP message(s) to the given mailbox (MOVE, RFC 6851)'
            cand raw 'Send one or more raw IMAP commands and print the verbatim server response'
        }
        &'himalaya;help;imap;id'= {
        }
        &'himalaya;help;imap;select'= {
        }
        &'himalaya;help;imap;create'= {
        }
        &'himalaya;help;imap;delete'= {
        }
        &'himalaya;help;imap;rename'= {
        }
        &'himalaya;help;imap;subscribe'= {
        }
        &'himalaya;help;imap;unsubscribe'= {
        }
        &'himalaya;help;imap;list'= {
        }
        &'himalaya;help;imap;status'= {
        }
        &'himalaya;help;imap;close'= {
        }
        &'himalaya;help;imap;unselect'= {
        }
        &'himalaya;help;imap;expunge'= {
        }
        &'himalaya;help;imap;search'= {
        }
        &'himalaya;help;imap;sort'= {
        }
        &'himalaya;help;imap;thread'= {
        }
        &'himalaya;help;imap;store'= {
        }
        &'himalaya;help;imap;flags'= {
        }
        &'himalaya;help;imap;fetch'= {
        }
        &'himalaya;help;imap;append'= {
        }
        &'himalaya;help;imap;copy'= {
        }
        &'himalaya;help;imap;move'= {
        }
        &'himalaya;help;imap;raw'= {
        }
        &'himalaya;help;jmap'= {
            cand query 'Send a raw JMAP method-calls array and print the response'
            cand mailbox 'Manage JMAP mailboxes'
            cand email 'Manage JMAP emails'
            cand thread 'Manage JMAP threads'
            cand identity 'Manage JMAP sender identities'
            cand submission 'Manage JMAP email submissions'
            cand vacation-response 'Manage JMAP vacation response'
        }
        &'himalaya;help;jmap;query'= {
        }
        &'himalaya;help;jmap;mailbox'= {
            cand get 'Get JMAP mailboxes by ID (Mailbox/get)'
            cand query 'Query JMAP mailboxes (Mailbox/query + Mailbox/get)'
            cand create 'Create a JMAP mailbox'
            cand update 'Update a JMAP mailbox'
            cand destroy 'Delete a JMAP mailbox'
        }
        &'himalaya;help;jmap;mailbox;get'= {
        }
        &'himalaya;help;jmap;mailbox;query'= {
        }
        &'himalaya;help;jmap;mailbox;create'= {
        }
        &'himalaya;help;jmap;mailbox;update'= {
        }
        &'himalaya;help;jmap;mailbox;destroy'= {
        }
        &'himalaya;help;jmap;email'= {
            cand get 'Get JMAP emails by ID (Email/get)'
            cand query 'Query JMAP emails (Email/query + Email/get)'
            cand read 'Read the content of a JMAP email (Email/get with body)'
            cand update 'Update JMAP emails via patch operations (Email/set)'
            cand delete 'Delete JMAP emails (Email/set destroy)'
            cand copy 'Copy JMAP emails from another account (Email/copy)'
            cand export 'Export a raw RFC 5322 message to stdout (Email/get + blob download)'
            cand import 'Import an RFC 5322 message into a mailbox (upload + Email/import)'
            cand parse 'Parse RFC 5322 message blobs without storing them (Email/parse)'
        }
        &'himalaya;help;jmap;email;get'= {
        }
        &'himalaya;help;jmap;email;query'= {
        }
        &'himalaya;help;jmap;email;read'= {
        }
        &'himalaya;help;jmap;email;update'= {
        }
        &'himalaya;help;jmap;email;delete'= {
        }
        &'himalaya;help;jmap;email;copy'= {
        }
        &'himalaya;help;jmap;email;export'= {
        }
        &'himalaya;help;jmap;email;import'= {
        }
        &'himalaya;help;jmap;email;parse'= {
        }
        &'himalaya;help;jmap;thread'= {
            cand get 'Fetch threads by ID (Thread/get)'
        }
        &'himalaya;help;jmap;thread;get'= {
        }
        &'himalaya;help;jmap;identity'= {
            cand get 'Fetch identities (Identity/get)'
            cand create 'Create a new identity (Identity/set)'
            cand update 'Update an existing identity (Identity/set)'
            cand delete 'Delete an identity (Identity/set)'
        }
        &'himalaya;help;jmap;identity;get'= {
        }
        &'himalaya;help;jmap;identity;create'= {
        }
        &'himalaya;help;jmap;identity;update'= {
        }
        &'himalaya;help;jmap;identity;delete'= {
        }
        &'himalaya;help;jmap;submission'= {
            cand get 'Fetch submissions by ID (EmailSubmission/get)'
            cand query 'Query and list submissions (EmailSubmission/query + EmailSubmission/get)'
            cand create 'Submit a draft email for sending (EmailSubmission/set)'
            cand cancel 'Cancel a pending submission (EmailSubmission/set)'
        }
        &'himalaya;help;jmap;submission;get'= {
        }
        &'himalaya;help;jmap;submission;query'= {
        }
        &'himalaya;help;jmap;submission;create'= {
        }
        &'himalaya;help;jmap;submission;cancel'= {
        }
        &'himalaya;help;jmap;vacation-response'= {
            cand get 'Get the vacation response (VacationResponse/get)'
            cand set 'Update the vacation response (VacationResponse/set)'
        }
        &'himalaya;help;jmap;vacation-response;get'= {
        }
        &'himalaya;help;jmap;vacation-response;set'= {
        }
        &'himalaya;help;gmail'= {
            cand profile 'Manage the Gmail user profile (users.getProfile)'
            cand labels 'Manage Gmail labels (users.labels)'
            cand messages 'Manage Gmail messages (users.messages)'
            cand attachments 'Manage Gmail message attachments (messages.attachments)'
            cand drafts 'Manage Gmail drafts (users.drafts)'
            cand threads 'Manage Gmail threads (users.threads)'
            cand history 'Manage the Gmail mailbox history (users.history)'
            cand settings 'Manage Gmail settings (users.settings), organized by sub-resource'
        }
        &'himalaya;help;gmail;profile'= {
            cand get 'Get the Gmail profile: email address, message/thread totals and the current history id'
        }
        &'himalaya;help;gmail;profile;get'= {
        }
        &'himalaya;help;gmail;labels'= {
            cand list 'List all Gmail labels (users.labels.list)'
            cand get 'Get one or more Gmail labels by identifier (users.labels.get)'
            cand create 'Create a Gmail label (users.labels.create)'
            cand update 'Update a Gmail label name (users.labels.update)'
            cand delete 'Delete a Gmail label (users.labels.delete)'
        }
        &'himalaya;help;gmail;labels;list'= {
        }
        &'himalaya;help;gmail;labels;get'= {
        }
        &'himalaya;help;gmail;labels;create'= {
        }
        &'himalaya;help;gmail;labels;update'= {
        }
        &'himalaya;help;gmail;labels;delete'= {
        }
        &'himalaya;help;gmail;messages'= {
            cand list 'List Gmail message ids matching the given query and labels (users.messages.list)'
            cand get 'Get a single Gmail message (users.messages.get)'
            cand send 'Send a Gmail message (users.messages.send)'
            cand import 'Import a Gmail message into the mailbox (users.messages.import)'
            cand insert 'Insert a Gmail message into the mailbox without sending (users.messages.insert)'
            cand modify 'Modify the labels of a Gmail message (users.messages.modify)'
            cand trash 'Move a Gmail message to the trash (users.messages.trash)'
            cand untrash 'Remove a Gmail message from the trash (users.messages.untrash)'
            cand delete 'Permanently delete a Gmail message (users.messages.delete)'
            cand batch-modify 'Modify the labels of several Gmail messages at once (users.messages.batchModify)'
            cand batch-delete 'Permanently delete several Gmail messages at once (users.messages.batchDelete)'
        }
        &'himalaya;help;gmail;messages;list'= {
        }
        &'himalaya;help;gmail;messages;get'= {
        }
        &'himalaya;help;gmail;messages;send'= {
        }
        &'himalaya;help;gmail;messages;import'= {
        }
        &'himalaya;help;gmail;messages;insert'= {
        }
        &'himalaya;help;gmail;messages;modify'= {
        }
        &'himalaya;help;gmail;messages;trash'= {
        }
        &'himalaya;help;gmail;messages;untrash'= {
        }
        &'himalaya;help;gmail;messages;delete'= {
        }
        &'himalaya;help;gmail;messages;batch-modify'= {
        }
        &'himalaya;help;gmail;messages;batch-delete'= {
        }
        &'himalaya;help;gmail;attachments'= {
            cand get 'Get a Gmail attachment by message and attachment id, then print or save its decoded bytes'
        }
        &'himalaya;help;gmail;attachments;get'= {
        }
        &'himalaya;help;gmail;drafts'= {
            cand list 'List Gmail drafts (users.drafts.list)'
            cand get 'Get a single Gmail draft (users.drafts.get)'
            cand create 'Create a Gmail draft (users.drafts.create)'
            cand update 'Update a Gmail draft (users.drafts.update)'
            cand send 'Send a Gmail draft (users.drafts.send)'
            cand delete 'Permanently delete a Gmail draft (users.drafts.delete)'
        }
        &'himalaya;help;gmail;drafts;list'= {
        }
        &'himalaya;help;gmail;drafts;get'= {
        }
        &'himalaya;help;gmail;drafts;create'= {
        }
        &'himalaya;help;gmail;drafts;update'= {
        }
        &'himalaya;help;gmail;drafts;send'= {
        }
        &'himalaya;help;gmail;drafts;delete'= {
        }
        &'himalaya;help;gmail;threads'= {
            cand list 'List Gmail threads matching the given query and labels (users.threads.list)'
            cand get 'Get a single Gmail thread with all its messages (users.threads.get)'
            cand modify 'Modify the labels of every message in a Gmail thread (users.threads.modify)'
            cand trash 'Move a Gmail thread to the trash (users.threads.trash)'
            cand untrash 'Remove a Gmail thread from the trash (users.threads.untrash)'
            cand delete 'Permanently delete a Gmail thread (users.threads.delete)'
        }
        &'himalaya;help;gmail;threads;list'= {
        }
        &'himalaya;help;gmail;threads;get'= {
        }
        &'himalaya;help;gmail;threads;modify'= {
        }
        &'himalaya;help;gmail;threads;trash'= {
        }
        &'himalaya;help;gmail;threads;untrash'= {
        }
        &'himalaya;help;gmail;threads;delete'= {
        }
        &'himalaya;help;gmail;history'= {
            cand list 'List the changes applied to the mailbox since a given history id'
        }
        &'himalaya;help;gmail;history;list'= {
        }
        &'himalaya;help;gmail;settings'= {
            cand vacation 'Manage the Gmail vacation responder settings (users.settings.getVacation / updateVacation)'
            cand imap 'Manage the Gmail IMAP access settings (users.settings.getImap / updateImap)'
            cand pop 'Manage the Gmail POP access settings (users.settings.getPop / updatePop)'
            cand language 'Manage the Gmail display language settings (users.settings.getLanguage / updateLanguage)'
            cand auto-forwarding 'Manage the Gmail auto-forwarding settings (users.settings.getAutoForwarding / updateAutoForwarding)'
            cand filters 'Manage Gmail filters (users.settings.filters)'
            cand forwarding-addresses 'Manage Gmail forwarding addresses (users.settings.forwardingAddresses)'
            cand delegates 'Manage Gmail delegates (users.settings.delegates)'
            cand send-as 'Manage Gmail send-as aliases (settings.sendAs)'
        }
        &'himalaya;help;gmail;settings;vacation'= {
            cand get 'Get the Gmail vacation responder settings'
            cand set 'Update the Gmail vacation responder settings'
        }
        &'himalaya;help;gmail;settings;vacation;get'= {
        }
        &'himalaya;help;gmail;settings;vacation;set'= {
        }
        &'himalaya;help;gmail;settings;imap'= {
            cand get 'Get the Gmail IMAP access settings'
            cand set 'Update the Gmail IMAP access settings'
        }
        &'himalaya;help;gmail;settings;imap;get'= {
        }
        &'himalaya;help;gmail;settings;imap;set'= {
        }
        &'himalaya;help;gmail;settings;pop'= {
            cand get 'Get the Gmail POP access settings'
            cand set 'Update the Gmail POP access settings'
        }
        &'himalaya;help;gmail;settings;pop;get'= {
        }
        &'himalaya;help;gmail;settings;pop;set'= {
        }
        &'himalaya;help;gmail;settings;language'= {
            cand get 'Get the Gmail display language settings'
            cand set 'Update the Gmail display language settings'
        }
        &'himalaya;help;gmail;settings;language;get'= {
        }
        &'himalaya;help;gmail;settings;language;set'= {
        }
        &'himalaya;help;gmail;settings;auto-forwarding'= {
            cand get 'Get the Gmail auto-forwarding settings'
            cand set 'Update the Gmail auto-forwarding settings'
        }
        &'himalaya;help;gmail;settings;auto-forwarding;get'= {
        }
        &'himalaya;help;gmail;settings;auto-forwarding;set'= {
        }
        &'himalaya;help;gmail;settings;filters'= {
            cand list 'List all Gmail filters (users.settings.filters.list)'
            cand get 'Get a Gmail filter by identifier (users.settings.filters.get)'
            cand create 'Create a Gmail filter (users.settings.filters.create)'
            cand delete 'Delete a Gmail filter (users.settings.filters.delete)'
        }
        &'himalaya;help;gmail;settings;filters;list'= {
        }
        &'himalaya;help;gmail;settings;filters;get'= {
        }
        &'himalaya;help;gmail;settings;filters;create'= {
        }
        &'himalaya;help;gmail;settings;filters;delete'= {
        }
        &'himalaya;help;gmail;settings;forwarding-addresses'= {
            cand list 'List all Gmail forwarding addresses (users.settings.forwardingAddresses.list)'
            cand get 'Get a Gmail forwarding address by email address (users.settings.forwardingAddresses.get)'
            cand create 'Create a Gmail forwarding address (users.settings.forwardingAddresses.create)'
            cand delete 'Delete a Gmail forwarding address (users.settings.forwardingAddresses.delete)'
        }
        &'himalaya;help;gmail;settings;forwarding-addresses;list'= {
        }
        &'himalaya;help;gmail;settings;forwarding-addresses;get'= {
        }
        &'himalaya;help;gmail;settings;forwarding-addresses;create'= {
        }
        &'himalaya;help;gmail;settings;forwarding-addresses;delete'= {
        }
        &'himalaya;help;gmail;settings;delegates'= {
            cand list 'List all Gmail delegates (users.settings.delegates.list)'
            cand get 'Get a Gmail delegate by email address (users.settings.delegates.get)'
            cand create 'Create a Gmail delegate (users.settings.delegates.create)'
            cand delete 'Delete a Gmail delegate (users.settings.delegates.delete)'
        }
        &'himalaya;help;gmail;settings;delegates;list'= {
        }
        &'himalaya;help;gmail;settings;delegates;get'= {
        }
        &'himalaya;help;gmail;settings;delegates;create'= {
        }
        &'himalaya;help;gmail;settings;delegates;delete'= {
        }
        &'himalaya;help;gmail;settings;send-as'= {
            cand list 'List all Gmail send-as aliases (settings.sendAs.list)'
            cand get 'Get one Gmail send-as alias by e-mail address (settings.sendAs.get)'
            cand create 'Create a Gmail send-as alias (settings.sendAs.create)'
            cand update 'Update a Gmail send-as alias (settings.sendAs.update/patch)'
            cand delete 'Delete a Gmail send-as alias (settings.sendAs.delete)'
            cand verify 'Send a verification e-mail for a Gmail send-as alias (settings.sendAs.verify)'
        }
        &'himalaya;help;gmail;settings;send-as;list'= {
        }
        &'himalaya;help;gmail;settings;send-as;get'= {
        }
        &'himalaya;help;gmail;settings;send-as;create'= {
        }
        &'himalaya;help;gmail;settings;send-as;update'= {
        }
        &'himalaya;help;gmail;settings;send-as;delete'= {
        }
        &'himalaya;help;gmail;settings;send-as;verify'= {
        }
        &'himalaya;help;msgraph'= {
            cand profile 'Manage the Microsoft Graph signed-in user (`GET /me`)'
            cand mail-folder 'Manage Microsoft Graph mail folders (`me.mailFolders`)'
            cand message 'Manage Microsoft Graph messages (`me.messages`)'
            cand attachment 'Manage Microsoft Graph message attachments (`me.messages.attachments`)'
        }
        &'himalaya;help;msgraph;profile'= {
            cand get 'Get the Microsoft Graph user profile: id, display name, mail and user principal name'
        }
        &'himalaya;help;msgraph;profile;get'= {
        }
        &'himalaya;help;msgraph;mail-folder'= {
            cand list 'List Microsoft Graph mail folders (`GET /me/mailFolders`)'
            cand child-folders 'List a mail folder''s child folders (`GET /me/mailFolders/{id}/childFolders`)'
            cand get 'Get one or more Microsoft Graph mail folders by id (`GET /me/mailFolders/{id}`)'
            cand create 'Create a Microsoft Graph mail folder under the mailbox root (`POST /me/mailFolders`)'
            cand rename 'Rename a Microsoft Graph mail folder (`PATCH /me/mailFolders/{id}`)'
            cand copy 'Copy a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/copy`)'
            cand move 'Move a Microsoft Graph mail folder into another folder (`POST /me/mailFolders/{id}/move`)'
            cand delete 'Delete a Microsoft Graph mail folder and everything in it (`DELETE /me/mailFolders/{id}`)'
        }
        &'himalaya;help;msgraph;mail-folder;list'= {
        }
        &'himalaya;help;msgraph;mail-folder;child-folders'= {
        }
        &'himalaya;help;msgraph;mail-folder;get'= {
        }
        &'himalaya;help;msgraph;mail-folder;create'= {
        }
        &'himalaya;help;msgraph;mail-folder;rename'= {
        }
        &'himalaya;help;msgraph;mail-folder;copy'= {
        }
        &'himalaya;help;msgraph;mail-folder;move'= {
        }
        &'himalaya;help;msgraph;mail-folder;delete'= {
        }
        &'himalaya;help;msgraph;message'= {
            cand list 'List Microsoft Graph messages (`GET /me/messages` or, with `--folder`, `GET /me/mailFolders/{id}/messages`)'
            cand get 'Get a single Microsoft Graph message (`GET /me/messages/{id}`), or its raw RFC 5322 bytes with `--raw` (`GET /me/messages/{id}/$value`)'
            cand create 'Create a Microsoft Graph draft message from raw MIME (`POST /me/messages`)'
            cand update 'Update a Microsoft Graph message (`PATCH /me/messages/{id}`): mark read/unread, set importance or replace categories'
            cand send 'Send a Microsoft Graph message from raw MIME (`POST /me/sendMail`); Graph saves it to Sent Items'
            cand copy 'Copy a Microsoft Graph message into another folder (`POST /me/messages/{id}/copy`)'
            cand move 'Move a Microsoft Graph message into another folder (`POST /me/messages/{id}/move`)'
            cand delete 'Permanently delete a Microsoft Graph message (`DELETE /me/messages/{id}`)'
        }
        &'himalaya;help;msgraph;message;list'= {
        }
        &'himalaya;help;msgraph;message;get'= {
        }
        &'himalaya;help;msgraph;message;create'= {
        }
        &'himalaya;help;msgraph;message;update'= {
        }
        &'himalaya;help;msgraph;message;send'= {
        }
        &'himalaya;help;msgraph;message;copy'= {
        }
        &'himalaya;help;msgraph;message;move'= {
        }
        &'himalaya;help;msgraph;message;delete'= {
        }
        &'himalaya;help;msgraph;attachment'= {
            cand list 'List a message''s attachments (`GET /me/messages/{id}/attachments`)'
            cand get 'Download an attachment''s content (`GET /me/messages/{id}/attachments/{aid}/$value`), then print or save its bytes'
            cand create 'Add a file attachment to a message (`POST /me/messages/{id}/attachments`)'
            cand delete 'Delete an attachment (`DELETE /me/messages/{id}/attachments/{aid}`)'
        }
        &'himalaya;help;msgraph;attachment;list'= {
        }
        &'himalaya;help;msgraph;attachment;get'= {
        }
        &'himalaya;help;msgraph;attachment;create'= {
        }
        &'himalaya;help;msgraph;attachment;delete'= {
        }
        &'himalaya;help;maildir'= {
            cand create 'Create a Maildir folder'
            cand rename 'Rename a Maildir folder'
            cand delete 'Delete a Maildir folder'
            cand list 'List Maildir folders'
            cand messages 'Manage MAILDIR messages'
            cand flags 'Manage MAILDIR flags'
        }
        &'himalaya;help;maildir;create'= {
        }
        &'himalaya;help;maildir;rename'= {
        }
        &'himalaya;help;maildir;delete'= {
        }
        &'himalaya;help;maildir;list'= {
        }
        &'himalaya;help;maildir;messages'= {
            cand save 'Store a message into a Maildir folder'
            cand copy 'Copy Maildir message(s) to another folder'
            cand move 'Move Maildir message(s) to another folder'
        }
        &'himalaya;help;maildir;messages;save'= {
        }
        &'himalaya;help;maildir;messages;copy'= {
        }
        &'himalaya;help;maildir;messages;move'= {
        }
        &'himalaya;help;maildir;flags'= {
            cand list 'List the standard Maildir flags'
            cand add 'Add MAILDIR flag(s) to message(s)'
            cand set 'Set MAILDIR flag(s) on message(s)'
            cand remove 'Remove MAILDIR flag(s) from message(s)'
        }
        &'himalaya;help;maildir;flags;list'= {
        }
        &'himalaya;help;maildir;flags;add'= {
        }
        &'himalaya;help;maildir;flags;set'= {
        }
        &'himalaya;help;maildir;flags;remove'= {
        }
        &'himalaya;help;m2dir'= {
            cand create 'Create the given m2dir folder'
            cand delete 'Delete the given m2dir folder'
            cand list 'List m2dir folders found under the store root'
            cand messages 'Manage M2DIR messages'
            cand flags 'Manage M2DIR flags'
        }
        &'himalaya;help;m2dir;create'= {
        }
        &'himalaya;help;m2dir;delete'= {
        }
        &'himalaya;help;m2dir;list'= {
        }
        &'himalaya;help;m2dir;messages'= {
            cand save 'Save a message to an m2dir folder'
        }
        &'himalaya;help;m2dir;messages;save'= {
        }
        &'himalaya;help;m2dir;flags'= {
            cand list 'List flags set on an m2dir message'
            cand add 'Add M2DIR flag(s) to message(s)'
            cand set 'Set M2DIR flag(s) on message(s) (replaces any existing flags)'
            cand remove 'Remove M2DIR flag(s) from message(s)'
        }
        &'himalaya;help;m2dir;flags;list'= {
        }
        &'himalaya;help;m2dir;flags;add'= {
        }
        &'himalaya;help;m2dir;flags;set'= {
        }
        &'himalaya;help;m2dir;flags;remove'= {
        }
        &'himalaya;help;smtp'= {
            cand send 'Send a raw RFC 5322 message (MAIL FROM / RCPT TO / DATA)'
            cand raw 'Send a raw SMTP command and print the verbatim reply'
        }
        &'himalaya;help;smtp;send'= {
        }
        &'himalaya;help;smtp;raw'= {
        }
        &'himalaya;help;configure'= {
        }
        &'himalaya;help;account'= {
            cand list 'List all accounts declared in the configuration'
            cand check 'Validate the account configuration'
        }
        &'himalaya;help;account;list'= {
        }
        &'himalaya;help;account;check'= {
        }
        &'himalaya;help;completion'= {
        }
        &'himalaya;help;manual'= {
        }
        &'himalaya;help;json-schema'= {
        }
        &'himalaya;help;help'= {
        }
    ]
    $completions[$command]
}
